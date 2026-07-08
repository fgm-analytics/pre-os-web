import React, { ReactNode, useMemo } from 'react';
import { Box, Typography, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Checkbox, Chip } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthProvider';
import { usePerformanceContext, PerformanceProvider } from '../contexts/PerformanceContext';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;
const SELECT_ALL_OPTION = { code: 'todos', name: 'Todos os Clientes' };

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
    if (newValue === 4) router.push({ pathname: '/performance/variacao', query }, undefined, { shallow: true });
  };

  const currentTab = (() => {
    if (router.pathname === '/performance') return 0;
    if (router.pathname === '/performance/faturamento') return 1;
    if (router.pathname === '/performance/valores-clientes-produtos') return 2;
    if (router.pathname === '/performance/ultimos-pedidos') return 3;
    if (router.pathname === '/performance/variacao') return 4;
    return 0;
  })();

  const isAllSelected = clients.length > 0 && selectedClient.length === clients.length;

  const handleClientChange = (event: any, newValue: any[]) => {
    const hasSelectAll = newValue.some(option => option.code === 'todos');
    if (hasSelectAll) {
      if (isAllSelected) {
        setSelectedClient([]);
      } else {
        setSelectedClient(clients.map(c => c.code));
      }
    } else {
      setSelectedClient(newValue.map(c => c.code));
    }
    setClientCodeInput('');
  };

  const autocompleteValue = useMemo(() => {
    const selectedObj = clients.filter(c => selectedClient.includes(c.code));
    if (clients.length > 0 && selectedClient.length === clients.length) {
      return [SELECT_ALL_OPTION, ...selectedObj];
    }
    return selectedObj;
  }, [selectedClient, clients]);

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
        <Tab label="Variação de Faturamento" sx={{ fontWeight: 700 }} />
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

        {currentTab !== 1 && currentTab !== 4 && (
          <>
            <Autocomplete<{ code: string; name: string }, true, false, false>
              multiple
              size="small"
              options={[SELECT_ALL_OPTION, ...clients]}
              disableCloseOnSelect
              getOptionLabel={(option) => option.code === 'todos' ? option.name : `${option.code} - ${option.name}`}
              value={autocompleteValue}
              onChange={handleClientChange}
              isOptionEqualToValue={(option, val) => option.code === val.code}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                const isTodos = option.code === 'todos';
                const isOptionChecked = isTodos ? isAllSelected : selected;
                return (
                  <li key={option.code} {...optionProps}>
                    <Checkbox
                      icon={icon}
                      checkedIcon={checkedIcon}
                      style={{ marginRight: 8 }}
                      checked={isOptionChecked}
                    />
                    {isTodos ? option.name : `${option.code} - ${option.name}`}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Cliente (Carteira)" 
                  placeholder={selectedClient.length === 0 ? "Pesquisar clientes..." : ""}
                />
              )}
              renderValue={(value, getItemProps) => (
                <>
                  {isAllSelected ? (
                    <Chip
                      key="todos"
                      label="Todos os Clientes"
                      size="small"
                      onDelete={() => {
                        setSelectedClient([]);
                        setClientCodeInput('');
                      }}
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ) : (
                    value
                      .filter(v => v.code !== 'todos')
                      .map((option, index) => {
                        const { key, ...tagProps } = getItemProps({ index });
                        return (
                          <Chip
                            key={option.code}
                            label={`${option.code} - ${option.name}`}
                            size="small"
                            {...tagProps}
                          />
                        );
                      })
                  )}
                </>
              )}
              sx={{ minWidth: 260, maxWidth: 400 }}
            />

            <TextField
              size="small"
              label="Cód. Cliente (Digitar)"
              variant="outlined"
              value={clientCodeInput}
              onChange={(e) => {
                setClientCodeInput(e.target.value);
                setSelectedClient([]);
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
