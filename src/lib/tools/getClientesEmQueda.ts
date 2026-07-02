import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR } from './shared';
import { ToolResult } from './types';

export async function getClientesEmQueda(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: clientes, error } = await supabaseAdmin
    .from('v_hist_cliente')
    .select('cliente_nome, realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('ano', CURRENT_YEAR)
    .order('realizado_faturamento', { ascending: true })
    .limit(5);
  if (error) return { error: 'Erro ao consultar clientes em queda.' };
  return { clientes: clientes || [] };
}
