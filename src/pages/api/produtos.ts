/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabase";
import { getListaProdutosV5 } from "../../lib/catalogService";

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
    const data = await getListaProdutosV5();
    return res.status(200).json(data);
  } catch (error) {
    console.error("API /api/produtos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar lista de produtos." });
  }
}
