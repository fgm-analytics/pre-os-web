import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR, formatCurrency, getCurrentMonth } from './shared';
import { ToolResult } from './types';

export async function getComparativoAnoPassado(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const currentMonth = getCurrentMonth();
  const { data: vendasPassado, error: errorPassado } = await supabaseAdmin
    .from('historico_faturamento')
    .select('realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('ano', CURRENT_YEAR - 1)
    .eq('mes', currentMonth);
  const { data: vendasAtual, error: errorAtual } = await supabaseAdmin
    .from('historico_faturamento')
    .select('realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('ano', CURRENT_YEAR)
    .eq('mes', currentMonth);
  if (errorPassado || errorAtual) return { error: 'Erro ao consultar comparativo anual.' };

  const calc = (arr: any[]) => (arr ? arr.reduce((acc, curr) => acc + Number(curr.realizado_faturamento || 0), 0) : 0);
  return {
    faturamento_passado: formatCurrency(calc(vendasPassado || [])),
    faturamento_atual: formatCurrency(calc(vendasAtual || [])),
  };
}
