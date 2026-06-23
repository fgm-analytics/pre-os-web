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

      // Paginated fetch helper with optional vendedor_code filter and PARALLEL fetching
      const fetchAllRows = async <T,>(table: string): Promise<T[]> => {
        // 1. Get exact count first
        let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
        
        if (visibleCodes.length === 1) {
          countQuery = countQuery.eq('vendedor_code', visibleCodes[0]);
        } else if (visibleCodes.length > 1) {
          countQuery = countQuery.in('vendedor_code', visibleCodes);
        } else {
          countQuery = countQuery.eq('vendedor_code', -1);
        }

        const { count, error: countErr } = await countQuery;
        if (countErr) throw countErr;
        if (!count || count === 0) return [];

        // 2. Generate functions that return promises for all pages to avoid starting them all at once
        const pages = Math.ceil(count / PAGE_SIZE);
        const pageFns = Array.from({ length: pages }).map((_, i) => {
          return () => {
            const from = i * PAGE_SIZE;
            let pageQuery = supabase.from(table).select('*');
            
            if (visibleCodes.length === 1) {
              pageQuery = pageQuery.eq('vendedor_code', visibleCodes[0]);
            } else if (visibleCodes.length > 1) {
              pageQuery = pageQuery.in('vendedor_code', visibleCodes);
            } else {
              pageQuery = pageQuery.eq('vendedor_code', -1);
            }
            
            return pageQuery.range(from, from + PAGE_SIZE - 1);
          };
        });

        // 3. Await pages in chunks to avoid overwhelming Supabase/Browser
        let allRows: T[] = [];
        const CONCURRENT_REQUESTS = 5;
        for (let i = 0; i < pageFns.length; i += CONCURRENT_REQUESTS) {
          const chunk = pageFns.slice(i, i + CONCURRENT_REQUESTS);
          const results = await Promise.all(chunk.map(fn => fn()));
          for (const res of results) {
            if (res.error) throw res.error;
            allRows = allRows.concat((res.data || []) as T[]);
          }
        }

        return allRows;
      };

      // Fetch ALL tables in parallel
      const [billing, performance, cpData, metaCpData, ultimosPedidos] = await Promise.all([
        fetchAllRows<BillingRecord>('historico_faturamento'),
        fetchAllRows<PerformanceRecord>('performance_vendedor_2026'),
        fetchAllRows<ClienteProdutoRecord>('historico_cliente_produto'),
        fetchAllRows<MetaClienteProdutoRecord>('meta_cliente_produto_2026'),
        fetchAllRows<UltimosPedidosRecord>('v_ultimos_pedidos')
      ]);

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
