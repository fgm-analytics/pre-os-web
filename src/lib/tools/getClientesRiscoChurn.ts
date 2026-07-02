import { supabaseAdmin } from '../supabaseAdmin';
import { ToolResult } from './types';

export async function getClientesRiscoChurn(args: any, vendedorCode?: number | null): Promise<ToolResult> {
  const tipo = args.tipo || 'risco';
  const diasMin = tipo === 'risco' ? 120 : 180;
  const diasMax = tipo === 'risco' ? 179 : 9999;

  const { data: clientes, error } = await supabaseAdmin
    .from('v_ultimos_pedidos')
    .select('cliente_nome, dias_desde_ultima_compra')
    .eq('vendedor_code', vendedorCode)
    .gte('dias_desde_ultima_compra', diasMin)
    .lte('dias_desde_ultima_compra', diasMax)
    .order('dias_desde_ultima_compra', { ascending: false })
    .limit(5);
  if (error) return { error: 'Erro ao consultar clientes em risco de churn.' };
  return { clientes: clientes || [] };
}
