import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCPriceEntries } from "../../lib/sfmc";
import redis, { getCachedData } from "../../lib/redis";
import { supabase } from "../../lib/supabase";

const getFilePath = () => {
  return path.join(process.cwd(), "data", "tabela_precos.json");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = getFilePath();

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Acesso não autorizado" });
  }

  if (req.method === "GET") {
    try {
      const data = await getCachedData("tabela_precos_v2", async () => {
        // Ler fallback: arquivo local tabela_precos.json
        let localPrices: Record<string, number> = {};
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          localPrices = JSON.parse(fileContent);
        }

        // Tentar buscar preços do SFMC (DE_PricebookZ3)
        const sfmcEntries = await fetchSFMCPriceEntries();

        if (sfmcEntries && sfmcEntries.length > 0) {
          const prices: Record<string, number> = { ...localPrices }; // Merge fallback with SFMC overriding
          sfmcEntries.forEach((entry) => {
            if (entry.ProductCode && entry.UnitPrice > 0) {
              prices[entry.ProductCode] = entry.UnitPrice;
            }
          });
          console.log(`[API precos] ${Object.keys(prices).length} preços mesclados (SFMC + local)`);
          return prices;
        }

        console.log("[API precos] SFMC indisponível, usando fallback local exclusivamente");
        return localPrices;
      }, 1800); // 30 minutos

      return res.status(200).json(data);
    } catch (error) {
      console.error("API /api/precos GET Error:", error);
      return res.status(500).json({ error: "Erro ao carregar tabela de preços." });
    }
  } else if (req.method === "POST") {
    try {
      const data = req.body;
      if (typeof data !== "object" || data === null) {
        return res.status(400).json({ error: "Dados inválidos." });
      }

      // Validar se todos os valores são numéricos e maiores/iguais a zero
      const sanitized: Record<string, number> = {};
      for (const [key, value] of Object.entries(data)) {
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue >= 0) {
          sanitized[key] = numValue;
        }
      }

      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), "utf-8");

      // Invalidar cache
      if (redis) {
        await redis.del("tabela_precos_v2");
      }

      return res.status(200).json({ success: true, count: Object.keys(sanitized).length });
    } catch (error) {
      console.error("API /api/precos POST Error:", error);
      return res.status(500).json({ error: "Erro ao salvar tabela de preços." });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }
}
