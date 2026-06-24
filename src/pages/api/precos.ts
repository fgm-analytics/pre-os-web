// API de Preços — leitura do SFMC (PricebookEntry_Salesforce, campo UnitPrice)
// Pricebook2Id = 01sV20000016SsKIAU
// Preços são definidos pela integração, não pelo admin.
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
    const prices = await getCachedData("tabela_precos_sfmc_v2", async () => {
      const entries = await fetchSFMCPriceEntries();
      const priceMap: Record<string, number> = {};

      if (entries && entries.length > 0) {
        entries.forEach((e) => {
          // ProductCode = código do produto (PK), UnitPrice = preço de tabela
          if (e.ProductCode && e.UnitPrice > 0) {
            priceMap[e.ProductCode] = e.UnitPrice;
          }
        });
        console.log(`[API precos] ${Object.keys(priceMap).length} preços carregados do SFMC`);
      } else {
        console.log("[API precos] SFMC sem dados de preços");
      }

      return priceMap;
    }, 1800);

    return res.status(200).json(prices);
  } catch (error) {
    console.error("API /api/precos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar preços do SFMC." });
  }
}
