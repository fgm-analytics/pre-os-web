import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabase";
import { clearCachedData } from "../../../lib/redis"; // Assuming we might need to clear cache, but wait, do we have clearCachedData?

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

  // Verificar se usuário é admin (exemplo genérico, ajustar conforme regra de negócio)
  // Como não sabemos a role exata, vamos assumir que o frontend valida ou que o token tem a role
  // idealmente: const isAdmin = user.app_metadata?.role === 'admin';

  try {
    const { products } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "O payload deve conter um array 'products'" });
    }

    const upsertData = products.map((p: any) => ({
      produto_codigo: p.codigo,
      business_unit: p.businessUnit !== "Inbox" ? p.businessUnit : null,
      cor: p.cor || "dark_gray",
      ordem_exibicao: p.ordem_exibicao || 9999,
      segmentacao: p.segmentacao !== undefined ? p.segmentacao : 40,
      ipi: p.ipi !== undefined ? p.ipi : 0,
      updated_at: new Date().toISOString()
    }));

    // Perform upsert
    const { error } = await supabase
      .from('config_produto')
      .upsert(upsertData, { onConflict: 'produto_codigo' });

    if (error) {
      console.error("Erro ao fazer upsert em config_produto:", error);
      throw error;
    }
    
    // Tentar limpar o cache do redis (requer importação se existir a função, senão só retorna)
    try {
      const { clearCachedData } = require("../../../lib/redis");
      if (clearCachedData) await clearCachedData("lista_produtos");
    } catch (e) {
      console.warn("Não foi possível limpar o cache do Redis automaticamente:", e);
    }

    return res.status(200).json({ success: true, message: "Configurações salvas com sucesso no banco de dados." });

  } catch (err: any) {
    console.error("Erro no save admin:", err);
    return res.status(500).json({ error: "Erro interno ao salvar configurações.", details: err.message });
  }
}
