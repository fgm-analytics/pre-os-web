import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }

  try {
    const dataDir = path.join(process.cwd(), "data");
    
    const dentscarePath = path.join(dataDir, "Dentscare.json");
    const homeCarePath = path.join(dataDir, "Home_Care.json");
    const whitenessPath = path.join(dataDir, "Whiteness.json");

    const dentscare = fs.existsSync(dentscarePath) 
      ? JSON.parse(fs.readFileSync(dentscarePath, "utf-8")) 
      : [];

    const homeCare = fs.existsSync(homeCarePath) 
      ? JSON.parse(fs.readFileSync(homeCarePath, "utf-8")) 
      : [];

    const whiteness = fs.existsSync(whitenessPath) 
      ? JSON.parse(fs.readFileSync(whitenessPath, "utf-8")) 
      : [];

    return res.status(200).json({
      Dentscare: dentscare,
      Home_Care: homeCare,
      Whiteness: whiteness,
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao ler lista de produtos." });
  }
}
