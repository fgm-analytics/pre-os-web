import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getAgendaVisita(_: any, vendedorCode?: number | null): Promise<ToolResult> {
  const { data: clientes, error } = await supabaseAdmin
    .from('v_ultimos_pedidos')
    .select('cliente_nome, dias_desde_ultima_compra, oportunidade_recompra')
    .eq('vendedor_code', vendedorCode)
    .eq('oportunidade_recompra', 'Sim')
    .order('dias_desde_ultima_compra', { ascending: false })
    .limit(3);
  if (error) return { error: 'Erro ao consultar agenda de visita.' };

  return {
    visitar_primeiro_hoje: clientes && clientes.length > 0 ? clientes[0] : null,
    maior_potencial_recompra: clientes || [],
  };
}
