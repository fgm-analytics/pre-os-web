import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getFocoVendas(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: focos, error } = await supabaseAdmin
    .from('v_ultimos_pedidos')
    .select('cliente_nome, dias_desde_ultima_compra, oportunidade_recompra')
    .eq('vendedor_code', vendedorCode)
    .eq('oportunidade_recompra', 'Sim')
    .order('dias_desde_ultima_compra', { ascending: false })
    .limit(5);
  if (error) return { error: 'Erro ao consultar foco de vendas.' };
  return { focos: focos || [] };
}
