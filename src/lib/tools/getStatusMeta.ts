import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR, formatCurrency, getCurrentMonth } from './shared';
import { ToolResult } from './types';

export async function getStatusMeta(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const currentMonth = getCurrentMonth();
  const { data: metas, error } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('subgrupo, meta_faturamento, realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('mes', currentMonth);
  if (error) return { error: 'Erro ao consultar a meta mensal. Contate o RevOps.' };

  let totalMeta = 0;
  let totalRealizado = 0;
  const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
  if (metas) {
    metas.forEach((m: any) => {
      if (!excludedGroups.includes(m.subgrupo)) {
        totalMeta += Number(m.meta_faturamento || 0);
        totalRealizado += Number(m.realizado_faturamento || 0);
      }
    });
  }

  const atingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : null;
  if (totalMeta === 0) return { error: 'Sem meta encontrada para o mês.' };
  return {
    meta_mensal: formatCurrency(totalMeta),
    realizado: formatCurrency(totalRealizado),
    atingimento: atingimento === null ? 'sem meta' : `${atingimento.toFixed(1)}%`,
    ano_referencia: CURRENT_YEAR,
  };
}
