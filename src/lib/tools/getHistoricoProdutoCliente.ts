import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function getHistoricoProdutoCliente(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { cliente, produto } = args;
  if (!cliente || !produto) return { error: 'Cliente e produto são obrigatórios.' };

  const { data: hist, error } = await supabaseAdmin
    .from('historico_cliente_produto')
    .select('ano, realizado_faturamento, realizado_volume')
    .eq('vendedor_code', vendedorCode)
    .ilike('cliente_nome', `%${cliente}%`)
    .ilike('subgrupo', `%${produto}%`)
    .order('ano', { ascending: false });

  if (error) return { error: 'Erro ao consultar o histórico.' };
  if (!hist || hist.length === 0) return { error: 'Nenhum histórico encontrado para este produto e cliente.' };

  const anos_faturados = hist.map((h: any) => ({
    ano: h.ano,
    unidades_faturadas: Number(h.realizado_volume || 0),
    valor_faturado: formatCurrency(Number(h.realizado_faturamento || 0))
  }));

  return { historico: anos_faturados };
}
