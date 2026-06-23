import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthProvider';

export interface BillingRecord {
  vendedor_code: number;
  vendedor_nome: string;
  cliente_code: string;
  cliente_nome: string;
  ano: number;
  mes: number;
  realizado_faturamento: number;
  realizado_volume: number;
}

export interface PerformanceRecord {
  vendedor_code: number;
  vendedor_nome: string;
  subgrupo: string;
  mes: number;
  meta_faturamento: number;
  realizado_faturamento: number;
  meta_volume: number;
  realizado_volume: number;
}

export interface ClienteProdutoRecord {
  vendedor_code: number;
  vendedor_nome: string;
  cliente_code: string;
  cliente_nome: string;
  subgrupo: string;
  ano: number;
  mes: number;
  realizado_faturamento: number;
  realizado_volume: number;
}

export interface MetaClienteProdutoRecord {
  vendedor_code: number;
  vendedor_nome: string;
  cliente_code: string;
  cliente_nome: string;
  subgrupo: string;
  mes: number;
  meta_faturamento: number;
  meta_volume: number;
}

export interface UltimosPedidosRecord {
  vendedor_code: number;
  cliente_code: string;
  cliente_nome: string;
  data_ultimo_pedido: string;
  dias_desde_ultima_compra: number;
  oportunidade_recompra: string;
}

export function usePerformanceData() {
  const { user, profile } = useAuth();
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceRecord[]>([]);
  const [clienteProdutoData, setClienteProdutoData] = useState<ClienteProdutoRecord[]>([]);
  const [metaClienteProdutoData, setMetaClienteProdutoData] = useState<MetaClienteProdutoRecord[]>([]);
  const [ultimosPedidosData, setUltimosPedidosData] = useState<UltimosPedidosRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    setError(null);

    const PAGE_SIZE = 1000;

    // Determine which vendedor_codes this user can see
    let visibleCodes: number[] = [];

    try {
      if (profile.role === 'vendedor') {
        // Vendedor sees only their own code
        if (profile.vendedor_code) {
          visibleCodes = [profile.vendedor_code];
        }
      } else if (profile.role === 'gerente') {
        // Gerente sees self + subordinates from hierarquia_vendedores
        const codes = new Set<number>();
        if (profile.vendedor_code) codes.add(profile.vendedor_code);

        if (profile.salesforce_id) {
          const { data: hierarchy } = await supabase
            .from('hierarquia_vendedores')
            .select('subordinado_vendedor_code')
            .eq('gerente_salesforce_id', profile.salesforce_id);

          if (hierarchy) {
            hierarchy.forEach(h => {
              if (h.subordinado_vendedor_code) codes.add(h.subordinado_vendedor_code);
            });
          }
        }
        visibleCodes = Array.from(codes);
      } else if (profile.role === 'admin') {
        // Admin sees all VALIDATED sellers (from hierarquia_vendedores)
        const codes = new Set<number>();
        const { data: allHierarchy } = await supabase
          .from('hierarquia_vendedores')
          .select('gerente_vendedor_code, subordinado_vendedor_code');
        
        if (allHierarchy) {
          allHierarchy.forEach(h => {
            if (h.gerente_vendedor_code) codes.add(h.gerente_vendedor_code);
            if (h.subordinado_vendedor_code) codes.add(h.subordinado_vendedor_code);
          });
        }
        visibleCodes = Array.from(codes);
      }

      // Paginated fetch helper with optional vendedor_code filter
      const fetchAllRows = async <T,>(table: string): Promise<T[]> => {
        let allRows: T[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase.from(table).select('*');

          // Push vendedor_code filter into the query
          // Non-admin roles and Admin roles now both have visibleCodes populated.
          // This ensures we ONLY fetch validated hierarchy sellers!
          if (visibleCodes.length === 1) {
            query = query.eq('vendedor_code', visibleCodes[0]);
          } else if (visibleCodes.length > 1) {
            query = query.in('vendedor_code', visibleCodes);
          } else {
            // Safety fallback if no codes found (shouldn't happen, but just in case)
            query = query.eq('vendedor_code', -1);
          }

          const { data, error: fetchErr } = await query.range(from, from + PAGE_SIZE - 1);

          if (fetchErr) throw fetchErr;

          allRows = allRows.concat((data || []) as T[]);
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }

        return allRows;
      };

      // 1. Fetch ALL historical billing (paginated, filtered)
      const billing = await fetchAllRows<BillingRecord>('historico_faturamento');

      // 2. Fetch ALL 2026 performance data (paginated, filtered)
      const performance = await fetchAllRows<PerformanceRecord>('performance_vendedor_2026');

      // 3. Fetch Cliente x Produto historical data
      const cpData = await fetchAllRows<ClienteProdutoRecord>('historico_cliente_produto');

      // 4. Fetch Cliente x Produto metas
      const metaCpData = await fetchAllRows<MetaClienteProdutoRecord>('meta_cliente_produto_2026');

      // 5. Fetch Últimos Pedidos
      const ultimosPedidos = await fetchAllRows<UltimosPedidosRecord>('v_ultimos_pedidos');

      setBillingData(billing);
      setPerformanceData(performance);
      setClienteProdutoData(cpData);
      setMetaClienteProdutoData(metaCpData);
      setUltimosPedidosData(ultimosPedidos);
    } catch (err: any) {
      console.error('Error fetching performance data:', err);
      setError(err.message || 'Erro ao carregar dados de performance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, profile]);

  return {
    billingData,
    performanceData,
    clienteProdutoData,
    metaClienteProdutoData,
    ultimosPedidosData,
    loading,
    error,
    refetch: fetchData
  };
}
