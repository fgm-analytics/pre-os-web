import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR } from './shared';
import { ToolResult } from './types';

export async function getSugestaoProdutosCliente(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: hist, error } = await supabaseAdmin
    .from('historico_cliente_produto')
    .select('subgrupo, ano, realizado_faturamento, realizado_volume')
    .eq('vendedor_code', vendedorCode)
    .ilike('cliente_nome', `%${args.cliente}%`);
  if (error) return { error: 'Erro ao consultar sugestões de produto.' };
  if (!hist || hist.length === 0) return { error: 'Nenhum histórico encontrado para este cliente.' };

  const agrupado: Record<string, { anos: Set<number>; faturamento: number }> = {};
  hist.forEach((h: any) => {
    const fat = Number(h.realizado_faturamento || 0);
    const vol = Number(h.realizado_volume || 0);
    if (fat > 0 || vol > 0) {
      if (!agrupado[h.subgrupo]) agrupado[h.subgrupo] = { anos: new Set(), faturamento: 0 };
      agrupado[h.subgrupo].anos.add(h.ano);
      agrupado[h.subgrupo].faturamento += fat;
    }
  });

  const parouDeComprar = Object.entries(agrupado)
    .filter(([, info]) => !info.anos.has(CURRENT_YEAR))
    .map(([sub]) => ({ produto_sugerido: sub, motivo: 'Comprou no passado mas não comprou este ano.' }));

  const focosPrincipais = Object.entries(agrupado)
    .filter(([, info]) => info.anos.has(CURRENT_YEAR))
    .sort((a, b) => b[1].faturamento - a[1].faturamento)
    .map(([sub]) => ({ produto_sugerido: sub, motivo: 'Curva A de compras deste cliente.' }));

  return {
    sugestoes_recuperacao: parouDeComprar.slice(0, 3),
    sugestoes_manutencao_cross_sell: focosPrincipais.slice(0, 3),
  };
}
