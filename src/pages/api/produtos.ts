import type { NextApiRequest, NextApiResponse } from "next";
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
    const data = await getCachedData("lista_produtos_v4", async () => {
      // 1. config_produto: sequência, cor, BU definidos pelo admin
      const { data: configProducts, error: configError } = await supabase
        .from("config_produto")
        .select("produto_codigo, business_unit, cor, segmentacao, ipi, ordem_exibicao")
        .order("ordem_exibicao", { ascending: true });

      if (configError || !configProducts || configProducts.length === 0) {
        console.error("Erro ao buscar config_produto:", configError);
        return { Dentscare: [], Home_Care: [], Whiteness: [] };
      }

      // 2. d_material: categoria e nome, filtrando os liberados
      const { data: dMaterial } = await supabase
        .from("d_material")
        .select("material, grupo_principal, descricao, status_material")
        .eq("status_material", "Liberado");

      const materialMap = new Map<string, { categoria: string; nome: string }>();
      if (dMaterial && dMaterial.length > 0) {
        dMaterial.forEach((row: any) => {
          const code = String(row.material || "").trim();
          const grupo = String(row.grupo_principal || "").trim();
          const nome = String(row.descricao || "").trim();
          if (code) materialMap.set(code, { categoria: grupo, nome });
        });
        console.log(`[API produtos] d_material carregado: ${materialMap.size} produtos liberados`);
      } else {
        console.log("[API produtos] d_material vazio ou sem produtos liberados");
      }

      // 3. Montar lista: base = config_produto, enriquecida com d_material
      const result: Record<string, any[]> = {
        Dentscare: [],
        Home_Care: [],
        Whiteness: [],
      };

      for (const cfg of configProducts) {
        const code = String(cfg.produto_codigo).trim();
        const bu = cfg.business_unit as string;

        if (!result[bu]) continue;

        const materialData = materialMap.get(code);
        
        // Se a instrução for rígida para deixar SÓ os liberados, e não achamos no map, podemos pular
        // (Se d_material estiver vazia, a tela não exibirá nada. Ajuste conforme necessidade do negócio)
        if (!materialData) {
          continue; 
        }

        const categoria = materialData.categoria || "Geral";
        const nomeProduto = materialData.nome || `[${code}]`;

        result[bu].push({
          codigo: code,
          material: nomeProduto,
          categoria,
          cor: cfg.cor || "dark_gray",
          businessUnit: bu,
          promotionIsActive: false, // Removido SFMC, sem promoções ativas da integração antiga
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
