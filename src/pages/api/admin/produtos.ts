/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { supabase } from "../../../lib/supabase";
import redis from "../../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

  const { data: profile } = await supabase.from('usuarios').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return res.status(403).json({ error: "Acesso negado: apenas administradores podem alterar o catálogo." });
  }

  try {
    const { products } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "O payload deve conter um array 'products'" });
    }

    // Group by Business Unit
    const grouped: Record<string, any[]> = {
      Dentscare: [],
      Home_Care: [],
      Whiteness: [],
    };

    // Note: Items in "Inbox" shouldn't be saved back to JSONs until they are moved to a real BU
    products.forEach((p: any) => {
      const bu = p.businessUnit;
      if (grouped[bu] !== undefined) {
        grouped[bu].push({
          codigo: p.codigo,
          material: p.material,
          categoria: p.categoria || "Geral",
          cor: p.cor || "dark_gray",
          segmentacao: p.segmentacao !== undefined ? p.segmentacao : 40,
          ipi: p.ipi !== undefined ? p.ipi : 0,
          ordem_exibicao: p.ordem_exibicao || 9999,
        });
      }
    });

    const dataDir = path.join(process.cwd(), "data");

    // Save each BU to its respective JSON file
    for (const bu of Object.keys(grouped)) {
      const buProducts = grouped[bu];
      // Sort by ordem_exibicao
      buProducts.sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);
      
      // Clean up the field ordem_exibicao before saving if desired, but keeping it is fine
      const jsonContent = JSON.stringify(buProducts, null, 2);
      fs.writeFileSync(path.join(dataDir, `${bu}.json`), jsonContent, "utf-8");
    }

    // Tentar limpar o cache do redis
    if (redis) {
      try {
        await redis.del("lista_produtos_v5");
      } catch (e) {
        console.warn("Não foi possível limpar o cache do Redis automaticamente:", e);
      }
    }

    return res.status(200).json({ success: true, message: "Configurações salvas com sucesso nos arquivos JSON." });

  } catch (err: any) {
    console.error("Erro no save admin:", err);
    return res.status(500).json({ error: "Erro interno ao salvar configurações.", details: err.message });
  }
}
