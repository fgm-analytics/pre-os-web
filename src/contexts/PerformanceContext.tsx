import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { usePerformanceData, BillingRecord, PerformanceRecord, ClienteProdutoRecord, MetaClienteProdutoRecord, UltimosPedidosRecord } from '../hooks/usePerformanceData';
import { useAuth } from './AuthProvider';

interface PerformanceContextProps {
  // Data from hook
  billingData: BillingRecord[];
  performanceData: PerformanceRecord[];
  clienteProdutoData: ClienteProdutoRecord[];
  metaClienteProdutoData: MetaClienteProdutoRecord[];
  ultimosPedidosData: UltimosPedidosRecord[];
  loading: boolean;
  error: string | null;

  // Filter State (synced with URL)
  selectedSeller: string;
  setSelectedSeller: (seller: string) => void;
  selectedClient: string;
  setSelectedClient: (client: string) => void;
  clientCodeInput: string;
  setClientCodeInput: (code: string) => void;

  // Derived options
  sellers: string[];
  clients: { code: string; name: string }[];

  // Helper for filtering
  matchesSelectedSeller: (r: { vendedor_code: number; vendedor_nome?: string }) => boolean;
}

const PerformanceContext = createContext<PerformanceContextProps | undefined>(undefined);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile } = useAuth();
  
  // Call the hook ONCE here
  const {
    billingData,
    performanceData,
    clienteProdutoData,
    metaClienteProdutoData,
    ultimosPedidosData,
    loading,
    error,
  } = usePerformanceData();

  // Local state synced with URL
  const [selectedSeller, setLocalSeller] = useState<string>('todos');
  const [selectedClient, setLocalClient] = useState<string>('todos');
  const [clientCodeInput, setClientCodeInput] = useState<string>('');

  // Sync state from URL on mount and route change
  useEffect(() => {
    if (router.isReady) {
      if (typeof router.query.seller === 'string') setLocalSeller(router.query.seller);
      if (typeof router.query.client === 'string') setLocalClient(router.query.client);
      if (typeof router.query.clientCode === 'string') setClientCodeInput(router.query.clientCode);
    }
  }, [router.isReady, router.query.seller, router.query.client, router.query.clientCode]);

  // Update URL when state changes
  const updateURL = (params: Record<string, string>) => {
    const newQuery = { ...router.query, ...params };
    // remove empty/default params to clean URL
    Object.keys(newQuery).forEach(k => {
      if (!newQuery[k] || newQuery[k] === 'todos' || newQuery[k] === '') {
        delete newQuery[k];
      }
    });
    router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
  };

  const setSelectedSeller = (seller: string) => {
    setLocalSeller(seller);
    updateURL({ seller });
  };

  const setSelectedClient = (client: string) => {
    setLocalClient(client);
    updateURL({ client });
  };

  const isVendedor = profile?.role === 'vendedor';
  const profileVendedorCode = profile?.vendedor_code ?? null;

  const getSellerName = (code: number) => {
    const found = billingData.find(b => b.vendedor_code === code);
    return found ? found.vendedor_nome : undefined;
  };

  const matchesSelectedSeller = (r: { vendedor_code: number; vendedor_nome?: string }) => {
    if (isVendedor) {
      return profileVendedorCode !== null && Number(r.vendedor_code) === Number(profileVendedorCode);
    }
    if (selectedSeller === 'todos') return true;
    
    // Usa o nome consistente do histórico de faturamento para evitar nomes sujos no CP
    const name = getSellerName(r.vendedor_code) || r.vendedor_nome;
    return name === selectedSeller;
  };

  const sellers = useMemo(() => {
    const list = new Set<string>();
    billingData.forEach(r => {
      if (r.vendedor_nome) list.add(r.vendedor_nome);
    });
    // Also check performanceData
    performanceData.forEach(r => {
      if (r.vendedor_nome) list.add(r.vendedor_nome);
    });
    return Array.from(list).sort();
  }, [billingData, performanceData]);

  const clients = useMemo(() => {
    const list = new Map<string, string>();
    billingData.forEach(r => {
      const matchSeller = matchesSelectedSeller(r);
      if (matchSeller && r.cliente_code) {
        list.set(r.cliente_code, r.cliente_nome || r.cliente_code);
      }
    });
    return Array.from(list.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [billingData, isVendedor, profileVendedorCode, selectedSeller]);

  return (
    <PerformanceContext.Provider value={{
      billingData,
      performanceData,
      clienteProdutoData,
      metaClienteProdutoData,
      ultimosPedidosData,
      loading,
      error,
      selectedSeller,
      setSelectedSeller,
      selectedClient,
      setSelectedClient,
      clientCodeInput,
      setClientCodeInput: (v) => { setClientCodeInput(v); updateURL({ clientCode: v }); },
      sellers,
      clients,
      matchesSelectedSeller
    }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformanceContext() {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformanceContext must be used within a PerformanceProvider');
  }
  return context;
}
