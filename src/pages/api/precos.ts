import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCProducts } from "../../lib/sfmc";

const getFilePath = () => {
  return path.join(process.cwd(), "data", "tabela_precos.json");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = getFilePath();

  if (req.method === "GET") {
    try {
      // Tentar buscar do SFMC
      const sfmcItems = await fetchSFMCProducts();

      if (sfmcItems && sfmcItems.length > 0) {
        const prices: Record<string, number> = {};
        sfmcItems.forEach((item) => {
          const codigo = item.keys.ProductCode;
          const unitPrice = item.values.UnitPrice ? parseFloat(item.values.UnitPrice) : 0;
          if (codigo && !isNaN(unitPrice)) {
            prices[codigo] = unitPrice;
          }
        });
        return res.status(200).json(prices);
      }

      // Fallback local
      if (!fs.existsSync(filePath)) {
        return res.status(200).json({});
      }
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(fileContent);
      return res.status(200).json(data);
    } catch (error) {
      console.error("API precos GET Error:", error);
      return res.status(500).json({ error: "Erro ao ler tabela de preços." });
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
      return res.status(200).json({ success: true, count: Object.keys(sanitized).length });
    } catch (error) {
      console.error("API precos POST Error:", error);
      return res.status(500).json({ error: "Erro ao salvar tabela de preços." });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }
}
