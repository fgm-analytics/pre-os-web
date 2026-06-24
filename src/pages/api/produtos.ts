import type { NextApiRequest, NextApiResponse } from "next";
import { fetchSFMCPriceEntries } from "../../lib/sfmc";
import { getCachedData } from "../../lib/redis";
import { supabase } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Acesso não autorizado" });
  }

  try {
    const data = await getCachedData("lista_produtos_v2", async () => {
      // 1. Buscar configuração de layout (ordem, cor, BU) — fonte da verdade para o catálogo
      const { data: configProducts, error: configError } = await supabase
        .from("config_produto")
        .select("produto_codigo, business_unit, cor, segmentacao, ipi, ordem_exibicao")
        .order("ordem_exibicao", { ascending: true });

      if (configError || !configProducts || configProducts.length === 0) {
        console.error("Erro ao buscar config_produto:", configError);
        return { Dentscare: [], Home_Care: [], Whiteness: [] };
      }

      // 2. Buscar dados de produto do SFMC (PricebookEntry_Salesforce)
      // Fonte: nome, preço de tabela, categoria (Grupo Principal), status ativo
      const sfmcEntries = await fetchSFMCPriceEntries();
      const sfmcMap = new Map<string, {
        name: string;
        unitPrice: number;
        isActive: boolean;
        grupoPrincipal: string;
      }>();

      if (sfmcEntries && sfmcEntries.length > 0) {
        sfmcEntries.forEach((e) => {
          sfmcMap.set(e.ProductCode, {
            name: e.ProductName,
            unitPrice: e.UnitPrice,
            isActive: e.IsActive,
            grupoPrincipal: e.GrupoPrincipal || "Geral",
          });
        });
      }

      // 3. Montar lista final: apenas produtos configurados no admin (config_produto)
      // O SFMC enriquece com nome, preço e categoria — mas não controla quais aparecem
      const result: Record<string, any[]> = {
        Dentscare: [],
        Home_Care: [],
        Whiteness: [],
      };

      for (const cfg of configProducts) {
        const code = String(cfg.produto_codigo).trim();
        const sfmc = sfmcMap.get(code);
        const bu = cfg.business_unit as string;

        // Ignorar BUs não reconhecidas (ex: Inbox legado)
        if (!result[bu]) continue;

        const item = {
          codigo: code,
          material: sfmc?.name || `Produto ${code}`,
          categoria: sfmc?.grupoPrincipal || "Geral",
          cor: cfg.cor || "dark_gray",
          businessUnit: bu,
          // Produto ativo = está no SFMC e tem IsActive = true
          // Se SFMC não retornou dados, exibe mas marcado como sem promoção ativa
          promotionIsActive: sfmc ? sfmc.isActive : false,
          promotionName: sfmc?.isActive ? "Ativo" : "",
          segmentacao: cfg.segmentacao !== null ? cfg.segmentacao : 40,
          ipi: cfg.ipi !== null ? cfg.ipi : 0,
          ordem_exibicao: cfg.ordem_exibicao,
        };

        result[bu].push(item);
      }

      return result;
    }, 1800); // cache 30 min

    return res.status(200).json(data);
  } catch (error) {
    console.error("API /api/produtos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar lista de produtos." });
  }
}
