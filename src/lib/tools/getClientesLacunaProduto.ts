import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR } from './shared';
import { ToolResult } from './types';

export async function getClientesLacunaProduto(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: hist, error } = await supabaseAdmin
    .from('historico_cliente_produto')
    .select('cliente_nome, ano')
    .eq('vendedor_code', vendedorCode)
    .ilike('subgrupo', `%${args.produto}%`)
    .order('ano', { ascending: false });
  if (error) return { error: 'Erro ao consultar lacuna de produto.' };
  if (!hist) return [];

  const maxAnoCliente: Record<string, number> = {};
  hist.forEach((h: any) => {
    if (!maxAnoCliente[h.cliente_nome] || h.ano > maxAnoCliente[h.cliente_nome]) {
      maxAnoCliente[h.cliente_nome] = h.ano;
    }
  });

  return Object.entries(maxAnoCliente)
    .filter(([, ano]) => ano < CURRENT_YEAR)
    .map(([cliente, ultimo_ano_compra]) => ({ cliente, ultimo_ano_compra }))
    .slice(0, 5);
}
