import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR, formatCurrency } from './shared';
import { ToolResult } from './types';

export async function getFaturamentoAcumuladoAno(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: meses, error } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('subgrupo, realizado_faturamento')
    .eq('vendedor_code', vendedorCode);
  if (error) return { error: 'Erro ao consultar faturamento acumulado.' };

  let totalAcumulado = 0;
  const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
  if (meses) {
    meses.forEach((m: any) => {
      if (!excludedGroups.includes(m.subgrupo)) {
        totalAcumulado += Number(m.realizado_faturamento || 0);
      }
    });
  }
  return { faturamento_acumulado_ytd: formatCurrency(totalAcumulado), ano_referencia: CURRENT_YEAR };
}
