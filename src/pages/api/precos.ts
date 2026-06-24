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
    const prices = await getCachedData("tabela_precos_dwh_v1", async () => {
      // Usamos a view vw_precos_dwh que faz o JOIN correto das tabelas do DWH
      // f_ordem_faturamento -> f_preco_condicao (filtrado por 'Z3')
      const { data: precosData, error } = await supabase
        .from("vw_precos_dwh")
        .select("produto_codigo, preco_tabela");

      if (error) {
        console.error("Erro ao buscar preços na view vw_precos_dwh:", error);
        return {};
      }

      const priceMap: Record<string, number> = {};

      if (precosData && precosData.length > 0) {
        precosData.forEach((row: any) => {
          const code = String(row.produto_codigo || "").trim();
          const price = Number(row.preco_tabela) || 0;
          
          if (code && price > 0) {
            priceMap[code] = price;
          }
        });
        console.log(`[API precos] ${Object.keys(priceMap).length} preços carregados do DWH`);
      } else {
        console.log("[API precos] Nenhuma informação de preço encontrada no DWH");
      }

      return priceMap;
    }, 1800); // 30 min cache

    return res.status(200).json(prices);
  } catch (error) {
    console.error("API /api/precos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar preços do DWH." });
  }
}
