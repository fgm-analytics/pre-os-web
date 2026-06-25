import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchSFMCDataExtensionPaginated } from '@/lib/sfmc';

// DE Keys based on our plan
const DE_KEYS = {
  D_ORG_VENDA: 'DE_d_org_venda',
  D_MATERIAL: 'DE_d_material',
  F_SHELF_LIFE: 'DE_f_shelf_life',
  F_PRECO_CONDICAO: 'DE_f_preco_condicao',
  F_ORDEM_FATURAMENTO: 'DE_f_ordem_faturamento'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificação de segurança (Authorization bearer) recomendada pela Vercel Cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results: Record<string, any> = {};

    // 1. Sync d_org_venda
    console.log(`[Cron] Syncing ${DE_KEYS.D_ORG_VENDA}...`);
    const orgVendaData = await fetchSFMCDataExtensionPaginated(DE_KEYS.D_ORG_VENDA);
    if (orgVendaData && orgVendaData.length > 0) {
      // Filtrar campos e garantir que null vira nulo, convertendo valores
      const mapped = orgVendaData.map(r => ({
        centro: r.centro,
        descricao: r.descricao
      })).filter(r => r.centro);
      
      const { error } = await supabaseAdmin.from('d_org_venda').upsert(mapped, { onConflict: 'centro' });
      results['d_org_venda'] = error ? error.message : `${mapped.length} records`;
    }

    // 2. Sync d_material
    console.log(`[Cron] Syncing ${DE_KEYS.D_MATERIAL}...`);
    const materialData = await fetchSFMCDataExtensionPaginated(DE_KEYS.D_MATERIAL);
    if (materialData && materialData.length > 0) {
      const mapped = materialData.map(r => ({
        material: r.material,
        descricao: r.descricao,
        grupo_principal: r.grupo_principal,
        status_material: r.status_material
      })).filter(r => r.material);
      
      const { error } = await supabaseAdmin.from('d_material').upsert(mapped, { onConflict: 'material' });
      results['d_material'] = error ? error.message : `${mapped.length} records`;
    }

    // 3. Sync f_shelf_life
    console.log(`[Cron] Syncing ${DE_KEYS.F_SHELF_LIFE}...`);
    const shelfLifeData = await fetchSFMCDataExtensionPaginated(DE_KEYS.F_SHELF_LIFE);
    if (shelfLifeData && shelfLifeData.length > 0) {
      const mapped = shelfLifeData.map(r => ({
        produto_codigo: r.produto_codigo,
        centro: r.centro,
        data_producao: r.data_producao,
        texto_breve_material: r.texto_breve_material,
        data_vencimento: r.data_vencimento,
        quantidade_estoque: parseFloat(r.quantidade_estoque) || 0
      })).filter(r => r.produto_codigo && r.centro);
      
      // Para o f_shelf_life, é melhor apagar e reinserir para evitar acúmulo infinito, 
      // ou fazer upsert se houver constraint composta.
      // Como a constraint não foi estritamente definida, vamos dar delete->insert
      const { error: delErr } = await supabaseAdmin.from('f_shelf_life').delete().neq('produto_codigo', 'CLEANUP');
      let errStr = delErr ? delErr.message : '';
      if (!delErr) {
        const { error: insErr } = await supabaseAdmin.from('f_shelf_life').insert(mapped);
        if (insErr) errStr = insErr.message;
      }
      results['f_shelf_life'] = errStr || `${mapped.length} records`;
    }

    // 4. Sync f_preco_condicao
    console.log(`[Cron] Syncing ${DE_KEYS.F_PRECO_CONDICAO}...`);
    const precoData = await fetchSFMCDataExtensionPaginated(DE_KEYS.F_PRECO_CONDICAO);
    if (precoData && precoData.length > 0) {
      const mapped = precoData.map(r => ({
        ov: r.ov,
        item_ov: r.item_ov,
        preco_zpr0: parseFloat((r.preco_zpr0 || "").toString().replace(',', '.')) || 0,
        cod_tipo_list_precos: r.cod_tipo_list_precos
      })).filter(r => r.ov && r.item_ov);
      
      const { error } = await supabaseAdmin.from('f_preco_condicao').upsert(mapped, { onConflict: 'ov,item_ov' });
      results['f_preco_condicao'] = error ? error.message : `${mapped.length} records`;
    }

    // 5. Sync f_ordem_faturamento
    console.log(`[Cron] Syncing ${DE_KEYS.F_ORDEM_FATURAMENTO}...`);
    const ordemData = await fetchSFMCDataExtensionPaginated(DE_KEYS.F_ORDEM_FATURAMENTO);
    if (ordemData && ordemData.length > 0) {
      const mapped = ordemData.map(r => ({
        chave_representante_ov: r.chave_representante_ov,
        material: r.material
      })).filter(r => r.chave_representante_ov && r.material);
      
      const { error } = await supabaseAdmin.from('f_ordem_faturamento').upsert(mapped, { onConflict: 'chave_representante_ov,material' });
      results['f_ordem_faturamento'] = error ? error.message : `${mapped.length} records`;
    }

    console.log('[Cron] DWH -> SFMC -> Supabase Sync Complete', results);
    return res.status(200).json({ success: true, results });

  } catch (err: any) {
    console.error('[Cron] Sync Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
