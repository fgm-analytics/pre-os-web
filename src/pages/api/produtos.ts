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
    const data = await getCachedData("lista_produtos_v3", async () => {
      // 1. config_produto: sequência, cor, BU definidos pelo admin
      const { data: configProducts, error: configError } = await supabase
        .from("config_produto")
        .select("produto_codigo, business_unit, cor, segmentacao, ipi, ordem_exibicao")
        .order("ordem_exibicao", { ascending: true });

      if (configError || !configProducts || configProducts.length === 0) {
        console.error("Erro ao buscar config_produto:", configError);
        return { Dentscare: [], Home_Care: [], Whiteness: [] };
      }

      // 2. d_material: categoria (Grupo Principal) — coluna "Material" é o código do produto
      // Pode estar vazia enquanto integração ERP não rodou — tratamos graciosamente
      const { data: dMaterial } = await supabase
        .from("d_material")
        .select('"Material", "Grupo Principal"');

      const categoriaMap = new Map<string, string>();
      if (dMaterial && dMaterial.length > 0) {
        dMaterial.forEach((row: any) => {
          const code = String(row["Material"] || "").trim();
          const grupo = String(row["Grupo Principal"] || "").trim();
          if (code && grupo) categoriaMap.set(code, grupo);
        });
        console.log(`[API produtos] d_material carregado: ${categoriaMap.size} registros`);
      } else {
        console.log("[API produtos] d_material vazia — categorias virão como 'Geral'");
      }

      // 3. SFMC PricebookEntry_Salesforce: nome (Name) e preço (UnitPrice)
      // Pricebook2Id = 01sV20000016SsKIAU
      const sfmcEntries = await fetchSFMCPriceEntries();
      const sfmcMap = new Map<string, { name: string; unitPrice: number; isActive: boolean }>();

      if (sfmcEntries && sfmcEntries.length > 0) {
        sfmcEntries.forEach((e) => {
          sfmcMap.set(e.ProductCode, {
            name: e.ProductName,
            unitPrice: e.UnitPrice,
            isActive: e.IsActive,
          });
        });
        console.log(`[API produtos] SFMC carregado: ${sfmcMap.size} produtos`);
      } else {
        console.log("[API produtos] SFMC sem dados — nomes e preços indisponíveis");
      }

      // 4. Montar lista: base = config_produto, enriquecida com SFMC + d_material
      const result: Record<string, any[]> = {
        Dentscare: [],
        Home_Care: [],
        Whiteness: [],
      };

      for (const cfg of configProducts) {
        const code = String(cfg.produto_codigo).trim();
        const bu = cfg.business_unit as string;

        if (!result[bu]) continue;

        const sfmc = sfmcMap.get(code);
        const categoria = categoriaMap.get(code) || "Geral";

        result[bu].push({
          codigo: code,
          // Nome: vem do SFMC (campo Name). Se SFMC offline, mostra código temporariamente.
          material: sfmc?.name && sfmc.name !== "" ? sfmc.name : `[${code}]`,
          categoria,
          cor: cfg.cor || "dark_gray",
          businessUnit: bu,
          promotionIsActive: sfmc ? sfmc.isActive : false,
          promotionName: "",
          segmentacao: cfg.segmentacao !== null ? cfg.segmentacao : 40,
          ipi: cfg.ipi !== null ? cfg.ipi : 0,
          ordem_exibicao: cfg.ordem_exibicao,
        });
      }

      return result;
    }, 1800); // 30 min cache

    return res.status(200).json(data);
  } catch (error) {
    console.error("API /api/produtos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar lista de produtos." });
  }
}
