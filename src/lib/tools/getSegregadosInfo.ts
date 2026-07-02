import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getSegregadosInfo(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: segregados, error } = await supabaseAdmin
    .from('f_shelf_life')
    .select('texto_breve_material, lote, quantidade_estoque')
    .ilike('texto_breve_material', `%${args.produto}%`)
    .limit(3);
  if (error) return { error: 'Erro ao consultar produtos segregados.' };
  return segregados && segregados.length > 0 ? { segregados } : { error: 'Produto não encontrado na lista de segregados.' };
}
