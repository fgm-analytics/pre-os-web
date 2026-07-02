import { supabaseAdmin } from '../supabaseAdmin';
import { formatCurrency, getCurrentMonth } from './shared';
import { ToolResult } from './types';

export async function getMetaProjecaoDiaria(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const currentMonth = getCurrentMonth();
  const { data: metas, error } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('subgrupo, meta_faturamento, realizado_faturamento')
    .eq('vendedor_code', vendedorCode)
    .eq('mes', currentMonth);
  if (error) return { error: 'Erro ao consultar projeção diária.' };

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

  const falta = totalMeta - totalRealizado;
  const diasUteisTotais = 22;
  const diasPassados = new Date().getDate() > 22 ? 22 : new Date().getDate();
  const diasRestantes = Math.max(1, diasUteisTotais - diasPassados);
  const metaDiaria = falta > 0 ? falta / diasRestantes : 0;

  const resp: ToolResult = {
    meta_restante: formatCurrency(falta > 0 ? falta : 0),
    dias_uteis_restantes: diasRestantes,
    meta_diaria_necessaria: formatCurrency(metaDiaria),
  };

  if (args.venda_hoje && args.venda_hoje > 0) {
    const novoRealizado = totalRealizado + Number(args.venda_hoje);
    const novoAtingimento = totalMeta > 0 ? (novoRealizado / totalMeta) * 100 : null;
    resp.projecao_atingimento_se_vender_hoje = novoAtingimento === null ? 'sem meta' : `${novoAtingimento.toFixed(1)}%`;
  }

  return resp;
}
