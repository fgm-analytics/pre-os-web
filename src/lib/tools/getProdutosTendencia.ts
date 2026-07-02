import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR } from './shared';
import { ToolResult } from './types';

export async function getProdutosTendencia(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: produtos, error } = await supabaseAdmin
    .from('historico_cliente_produto')
    .select('subgrupo, realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('ano', CURRENT_YEAR)
    .order('realizado_faturamento', { ascending: false })
    .limit(5);
  if (error) return { error: 'Erro ao consultar tendências de produtos.' };
  return { produtos: produtos || [] };
}
