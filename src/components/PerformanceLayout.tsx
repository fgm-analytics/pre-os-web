import React, { ReactNode } from 'react';
import { Box, Typography, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthProvider';
import { usePerformanceContext, PerformanceProvider } from '../contexts/PerformanceContext';

function LayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { 
    selectedSeller, setSelectedSeller, 
    selectedClient, setSelectedClient, 
    clientCodeInput, setClientCodeInput,
    sellers, clients 
  } = usePerformanceContext();

  const isVendedor = profile?.role === 'vendedor';

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // Preserve query parameters
    const query = router.query;
    if (newValue === 0) router.push({ pathname: '/performance', query }, undefined, { shallow: true });
    if (newValue === 1) router.push({ pathname: '/performance/faturamento', query }, undefined, { shallow: true });
    if (newValue === 2) router.push({ pathname: '/performance/valores-clientes-produtos', query }, undefined, { shallow: true });
    if (newValue === 3) router.push({ pathname: '/performance/ultimos-pedidos', query }, undefined, { shallow: true });
  };

  const currentTab = (() => {
    if (router.pathname === '/performance') return 0;
    if (router.pathname === '/performance/faturamento') return 1;
    if (router.pathname === '/performance/valores-clientes-produtos') return 2;
    if (router.pathname === '/performance/ultimos-pedidos') return 3;
    return 0;
  })();

  return (
    <Box>
      {/* Tabs */}
      <Tabs 
        value={currentTab} 
        onChange={handleTabChange}
        sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Menu Histórico" sx={{ fontWeight: 700 }} />
        <Tab label="Faturado Vendedor Mês" sx={{ fontWeight: 700 }} />
        <Tab label="Valores Clientes Produtos" sx={{ fontWeight: 700 }} />
        <Tab label="Últimos Pedidos" sx={{ fontWeight: 700 }} />
      </Tabs>

      {/* Global Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {isVendedor ? (
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', px: 2, py: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: 40 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1, fontWeight: 500 }}>Vendedor:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{profile?.nome ?? '—'}</Typography>
          </Box>
        ) : (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Vendedor</InputLabel>
            <Select
              value={selectedSeller}
              label="Vendedor"
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              {sellers.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {currentTab !== 1 && (
          <>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Cliente (Carteira)</InputLabel>
              <Select
                value={selectedClient}
                label="Cliente (Carteira)"
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  setClientCodeInput('');
                }}
              >
                <MenuItem value="todos">Todos os Clientes</MenuItem>
                {clients.map(c => (
                  <MenuItem key={c.code} value={c.code}>{c.code} - {c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Cód. Cliente (Digitar)"
              variant="outlined"
              value={clientCodeInput}
              onChange={(e) => {
                setClientCodeInput(e.target.value);
                setSelectedClient('todos');
              }}
              sx={{ minWidth: 180 }}
            />
          </>
        )}
      </Box>

      {/* Page Content */}
      {children}
    </Box>
  );
}

// Wrapper to provide context
export default function PerformanceLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutInner>{children}</LayoutInner>
  );
}
