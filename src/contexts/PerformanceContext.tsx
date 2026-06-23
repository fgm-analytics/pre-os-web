import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
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
  
  const [availableSellers, setAvailableSellers] = useState<{code: number, name: string}[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  // Local state synced with URL. Default to empty string.
  const [selectedSeller, setLocalSeller] = useState<string>('');
  const [selectedClient, setLocalClient] = useState<string>('todos');
  const [clientCodeInput, setClientCodeInput] = useState<string>('');

  // 1. Fetch available sellers based on hierarchy
  useEffect(() => {
    if (!profile) return;
    
    const loadSellers = async () => {
      setLoadingContext(true);
      let visibleCodes: number[] = [];
      
      if (profile.role === 'vendedor' && profile.vendedor_code) {
        visibleCodes = [profile.vendedor_code];
      } else if (profile.role === 'gerente') {
        const codes = new Set<number>();
        if (profile.vendedor_code) codes.add(profile.vendedor_code);
        if (profile.salesforce_id) {
          const { data: hierarchy } = await supabase.from('hierarquia_vendedores')
            .select('subordinado_vendedor_code')
            .eq('gerente_salesforce_id', profile.salesforce_id);
          if (hierarchy) hierarchy.forEach(h => { if (h.subordinado_vendedor_code) codes.add(h.subordinado_vendedor_code); });
        }
        visibleCodes = Array.from(codes);
      } else if (profile.role === 'admin') {
        const codes = new Set<number>();
        const { data: allHierarchy } = await supabase.from('hierarquia_vendedores')
          .select('gerente_vendedor_code, subordinado_vendedor_code');
        if (allHierarchy) {
          allHierarchy.forEach(h => {
            if (h.gerente_vendedor_code) codes.add(h.gerente_vendedor_code);
            if (h.subordinado_vendedor_code) codes.add(h.subordinado_vendedor_code);
          });
        }
        visibleCodes = Array.from(codes);
      }

      // Fetch names for these codes
      if (visibleCodes.length > 0) {
        const names = await Promise.all(visibleCodes.map(async (code) => {
          // Try to get from historico_faturamento first
          const { data } = await supabase.from('historico_faturamento')
            .select('vendedor_nome')
            .eq('vendedor_code', code)
            .limit(1)
            .single();
          if (data) return { code, name: data.vendedor_nome };
          
          // Fallback to performance table
          const { data: pData } = await supabase.from('performance_vendedor_2026')
            .select('vendedor_nome')
            .eq('vendedor_code', code)
            .limit(1)
            .single();
          return { code, name: pData ? pData.vendedor_nome : `Vendedor ${code}` };
        }));
        
        // Remove duplicates if any and sort
        const uniqueNames = Array.from(new Map(names.map(item => [item.code, item])).values());
        setAvailableSellers(uniqueNames.sort((a, b) => a.name.localeCompare(b.name)));
      }
      setLoadingContext(false);
    };

    loadSellers();
  }, [profile]);

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

  // Auto-select first seller if none is selected
  useEffect(() => {
    if (availableSellers.length > 0 && (!selectedSeller || selectedSeller === 'todos')) {
      if (typeof router.query.seller === 'string') {
        setLocalSeller(router.query.seller);
      } else {
        // Default to logged in user if they are in the list, else first seller
        const defaultSeller = profile?.nome && availableSellers.some(s => s.name === profile.nome) 
          ? profile.nome 
          : availableSellers[0].name;
        setLocalSeller(defaultSeller);
        updateURL({ seller: defaultSeller });
      }
    }
  }, [availableSellers, selectedSeller, router.query.seller, profile]);

  // Find the selected seller code
  const selectedSellerCode = useMemo(() => {
    const found = availableSellers.find(s => s.name === selectedSeller);
    return found ? found.code : null;
  }, [availableSellers, selectedSeller]);

  // 2. Call the hook with the specific selectedSellerCode
  const {
    billingData,
    performanceData,
    clienteProdutoData,
    metaClienteProdutoData,
    ultimosPedidosData,
    loading: loadingData,
    error,
  } = usePerformanceData(selectedSellerCode);

  const isVendedor = profile?.role === 'vendedor';
  const profileVendedorCode = profile?.vendedor_code ?? null;

  const matchesSelectedSeller = (r: { vendedor_code: number; vendedor_nome?: string }) => {
    if (isVendedor) {
      return profileVendedorCode !== null && Number(r.vendedor_code) === Number(profileVendedorCode);
    }
    // Now that we fetch strictly by selectedSellerCode, all rows in billingData 
    // are guaranteed to belong to the selected seller anyway!
    return true; 
  };

  const sellers = availableSellers.map(s => s.name);

  const clients = useMemo(() => {
    const list = new Map<string, string>();
    billingData.forEach(r => {
      if (r.cliente_code) {
        list.set(r.cliente_code, r.cliente_nome || r.cliente_code);
      }
    });
    return Array.from(list.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [billingData]);

  return (
    <PerformanceContext.Provider value={{
      billingData,
      performanceData,
      clienteProdutoData,
      metaClienteProdutoData,
      ultimosPedidosData,
      loading: loadingContext || loadingData,
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
