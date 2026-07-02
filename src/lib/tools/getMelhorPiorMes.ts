import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR, formatCurrency } from './shared';
import { ToolResult } from './types';

export async function getMelhorPiorMes(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: meses, error } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('subgrupo, mes, realizado_faturamento')
    .eq('vendedor_code', vendedorCode);
  if (error) return { error: 'Erro ao consultar melhor e pior mês.' };

  if (!meses || meses.length === 0) return { error: 'Sem dados para este ano.' };

  const agrupado: Record<number, number> = {};
  const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
  meses.forEach((m: any) => {
    if (!excludedGroups.includes(m.subgrupo)) {
      agrupado[m.mes] = (agrupado[m.mes] || 0) + Number(m.realizado_faturamento || 0);
    }
  });

  const entries = Object.entries(agrupado).map(([m, val]) => ({ mes: Number(m), faturamento: val }));
  entries.sort((a, b) => b.faturamento - a.faturamento);

  return {
    melhor_mes: { mes: entries[0].mes, faturamento: formatCurrency(entries[0].faturamento) },
    pior_mes: { mes: entries[entries.length - 1].mes, faturamento: formatCurrency(entries[entries.length - 1].faturamento) },
    ano_referencia: CURRENT_YEAR,
  };
}
