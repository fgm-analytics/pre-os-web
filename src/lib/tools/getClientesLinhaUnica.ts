import { supabaseAdmin } from '../supabaseAdmin';
import { CURRENT_YEAR } from './shared';
import { ToolResult } from './types';

export async function getClientesLinhaUnica(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: hist, error } = await supabaseAdmin
    .from('historico_cliente_produto')
    .select('cliente_nome, subgrupo')
    .eq('vendedor_code', vendedorCode)
    .eq('ano', CURRENT_YEAR);
  if (error) return { error: 'Erro ao consultar clientes de linha única.' };
  if (!hist) return [];

  const mapClienteSubgrupos: Record<string, Set<string>> = {};
  hist.forEach((h: any) => {
    if (!mapClienteSubgrupos[h.cliente_nome]) mapClienteSubgrupos[h.cliente_nome] = new Set();
    mapClienteSubgrupos[h.cliente_nome].add(h.subgrupo);
  });

  return Object.entries(mapClienteSubgrupos)
    .filter(([, set]) => set.size === 1)
    .map(([cliente, set]) => ({ cliente, linha_comprada: Array.from(set)[0] }))
    .slice(0, 5);
}
