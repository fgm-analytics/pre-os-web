import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getClienteDiasSemCompra(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: cliente, error } = await supabaseAdmin
    .from('v_ultimos_pedidos')
    .select('cliente_nome, dias_desde_ultima_compra')
    .eq('vendedor_code', vendedorCode)
    .ilike('cliente_nome', `%${args.cliente}%`)
    .limit(1);
  if (error) return { error: 'Erro ao consultar dias sem compra.' };
  return cliente && cliente.length > 0 ? cliente[0] : { error: 'Cliente não encontrado ou não tem histórico.' };
}
