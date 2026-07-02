import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getSegregadosAlertas(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setDate(hoje.getDate() + 30);

  const { data: vencendo, error: errorVencendo } = await supabaseAdmin
    .from('f_shelf_life')
    .select('texto_breve_material, lote, data_vencimento')
    .gte('data_vencimento', hoje.toISOString())
    .lte('data_vencimento', dataLimite.toISOString());
  if (errorVencendo) return { error: 'Erro ao consultar alertas de vencimento.' };

  const { data: maiorEstoque, error: errorEstoque } = await supabaseAdmin
    .from('f_shelf_life')
    .select('texto_breve_material, quantidade_estoque')
    .order('quantidade_estoque', { ascending: false })
    .limit(1);
  if (errorEstoque) return { error: 'Erro ao consultar maior estoque.' };

  return {
    vencendo_em_30_dias: vencendo || [],
    maior_estoque: maiorEstoque && maiorEstoque.length > 0 ? maiorEstoque[0] : null,
  };
}
