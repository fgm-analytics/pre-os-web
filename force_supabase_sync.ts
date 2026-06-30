import { supabaseAdmin } from './src/lib/supabase';
import { fetchSFMCDataExtensionPaginated } from './src/lib/sfmc';

// Script adaptado para rodar a cron function via CLI.

const DE_KEYS = {
  D_ORG_VENDA: 'DE_d_org_venda',
  D_MATERIAL: 'DE_d_material',
  F_SHELF_LIFE: 'DE_f_shelf_life',
  F_PRECO_CONDICAO: 'DE_f_preco_condicao',
  F_ORDEM_FATURAMENTO: 'DE_f_ordem_faturamento'
};

async function runLocalSync() {
  console.log("Iniciando sincronização local SFMC -> Supabase ODS...");
  try {
    const results: Record<string, string> = {};

    console.log(`[Cron] Syncing ${DE_KEYS.F_PRECO_CONDICAO}...`);
    const precoData = await fetchSFMCDataExtensionPaginated(DE_KEYS.F_PRECO_CONDICAO);
    if (precoData && precoData.length > 0) {
      const mapped = precoData.map((r: { ov: string; item_ov: string; preco_zpr0?: string | number; cod_tipo_list_precos?: string }) => ({
        ov: r.ov,
        item_ov: r.item_ov,
        preco_zpr0: parseFloat((r.preco_zpr0 || "").toString().replace(',', '.')) || 0,
        cod_tipo_list_precos: r.cod_tipo_list_precos
      })).filter((r: { ov: string; item_ov: string }) => r.ov && r.item_ov);
      
      const { error } = await supabaseAdmin.from('f_preco_condicao').upsert(mapped, { onConflict: 'ov,item_ov' });
      results['f_preco_condicao'] = error ? error.message : `${mapped.length} records`;
      console.log(`Preços sincronizados: ${results['f_preco_condicao']}`);
    }

    console.log(`[Cron] Syncing ${DE_KEYS.F_ORDEM_FATURAMENTO}...`);
    const ordemData = await fetchSFMCDataExtensionPaginated(DE_KEYS.F_ORDEM_FATURAMENTO);
    if (ordemData && ordemData.length > 0) {
      const mapped = ordemData.map((r: { chave_representante_ov: string; material: string }) => ({
        chave_representante_ov: r.chave_representante_ov,
        material: r.material
      })).filter((r: { chave_representante_ov: string; material: string }) => r.chave_representante_ov && r.material);
      
      const { error } = await supabaseAdmin.from('f_ordem_faturamento').upsert(mapped, { onConflict: 'chave_representante_ov,material' });
      results['f_ordem_faturamento'] = error ? error.message : `${mapped.length} records`;
      console.log(`Ordens faturamento sincronizadas: ${results['f_ordem_faturamento']}`);
    }

    console.log("Sincronização SFMC -> Supabase finalizada!", results);
  } catch (err) {
    console.error('[Cron] Sync Error:', err);
  }
}

runLocalSync();
