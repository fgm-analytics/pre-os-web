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

      // 2. d_material: categoria e nome
      const { data: dMaterial } = await supabase
        .from("d_material")
        .select("material, grupo_principal, descricao, status_material");

      const materialMap = new Map<string, { categoria: string; nome: string; status: string }>();
      if (dMaterial && dMaterial.length > 0) {
        dMaterial.forEach((row: any) => {
          const code = String(row.material || "").trim();
          const grupo = String(row.grupo_principal || "").trim();
          const nome = String(row.descricao || "").trim();
          const status = String(row.status_material || "").trim();
          if (code) materialMap.set(code, { categoria: grupo, nome, status });
        });
        console.log(`[API produtos] d_material carregado: ${materialMap.size} produtos`);
      } else {
        console.log("[API produtos] d_material vazio");
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
        
        // Se temos o status do material explicitamente diferente de "Liberado", nós ignoramos
        if (materialData && materialData.status && materialData.status !== "Liberado") {
          continue; 
        }

        const categoria = materialData?.categoria || "Geral";
        const nomeProduto = materialData?.nome || `[${code}]`;

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
