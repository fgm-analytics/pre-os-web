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

export function usePerformanceData(selectedSellerCode: number | null) {
  const { user, profile } = useAuth();
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceRecord[]>([]);
  const [clienteProdutoData, setClienteProdutoData] = useState<ClienteProdutoRecord[]>([]);
  const [metaClienteProdutoData, setMetaClienteProdutoData] = useState<MetaClienteProdutoRecord[]>([]);
  const [ultimosPedidosData, setUltimosPedidosData] = useState<UltimosPedidosRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user || !profile || !selectedSellerCode) {
      setBillingData([]);
      setPerformanceData([]);
      setClienteProdutoData([]);
      setMetaClienteProdutoData([]);
      setUltimosPedidosData([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const PAGE_SIZE = 1000;

    try {
      // Paginated fetch helper with PARALLEL chunking
      const fetchAllRows = async <T,>(table: string): Promise<T[]> => {
        // 1. Get exact count first
        let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
        countQuery = countQuery.eq('vendedor_code', selectedSellerCode);

        const { count, error: countErr } = await countQuery;
        if (countErr) throw countErr;
        if (!count || count === 0) return [];

        // 2. Generate functions that return promises for all pages to avoid starting them all at once
        const pages = Math.ceil(count / PAGE_SIZE);
        const pageFns = Array.from({ length: pages }).map((_, i) => {
          return () => {
            const from = i * PAGE_SIZE;
            let pageQuery = supabase.from(table).select('*');
            pageQuery = pageQuery.eq('vendedor_code', selectedSellerCode);
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
  }, [user, profile, selectedSellerCode]);

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
