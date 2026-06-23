import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab, TableSortLabel, Chip
} from '@mui/material';
import { usePerformanceContext } from '../../contexts/PerformanceContext';
import { UltimosPedidosRecord } from '../../hooks/usePerformanceData';
import { useRouter } from 'next/router';
import PerformanceLayout from '../../components/PerformanceLayout';
import { ReactElement } from 'react';

type Order = 'asc' | 'desc';

export default function UltimosPedidos() {
  const router = useRouter();
  const { 
    ultimosPedidosData, loading, error,
    matchesSelectedSeller, selectedClient, clientCodeInput, clients
  } = usePerformanceContext();
  
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof UltimosPedidosRecord>('cliente_nome');

  const handleRequestSort = (property: keyof UltimosPedidosRecord) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const getRecompraColor = (status: string) => {
    switch(status) {
      case 'Ativo': return 'success';
      case 'Oportunidade': return 'warning';
      case 'Inativo': return 'error';
      case 'Crítico': return 'error';
      case 'Desativado': return 'default';
      default: return 'default';
    }
  };

  const currentClientCode = useMemo(() => {
    if (clientCodeInput.trim() !== '') {
      const matched = clients.find(c => c.code.toLowerCase().includes(clientCodeInput.trim().toLowerCase()));
      return matched ? matched.code : clientCodeInput.trim();
    }
    return selectedClient !== 'todos' ? selectedClient : '';
  }, [clientCodeInput, selectedClient, clients]);

  const filteredData = useMemo(() => {
    return ultimosPedidosData.filter(r => {
      const matchSeller = matchesSelectedSeller(r);
      const matchClient = currentClientCode ? r.cliente_code === currentClientCode : true;
      return matchSeller && matchClient;
    });
  }, [ultimosPedidosData, matchesSelectedSeller, currentClientCode]);

  const sortedData = useMemo(() => {
    const comparator = (a: UltimosPedidosRecord, b: UltimosPedidosRecord) => {
      let aVal: any = a[orderBy];
      let bVal: any = b[orderBy];

      if (orderBy === 'data_ultimo_pedido') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (bVal < aVal) return order === 'asc' ? 1 : -1;
      if (bVal > aVal) return order === 'asc' ? -1 : 1;
      return 0;
    };

    return [...filteredData].sort(comparator);
  }, [filteredData, order, orderBy]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Head>
        <title>Performance - Últimos Pedidos</title>
      </Head>



      <Typography variant="h5" sx={{ mb: 3, fontWeight: 800 }}>
        Últimos Pedidos por Cliente
      </Typography>

      <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <TableContainer sx={{ maxHeight: '70vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper', position: 'sticky', left: 0, zIndex: 3, minWidth: { xs: 120, md: 200 }, maxWidth: { xs: 150, md: 250 } }}>
                  <TableSortLabel
                    active={orderBy === 'cliente_nome'}
                    direction={orderBy === 'cliente_nome' ? order : 'asc'}
                    onClick={() => handleRequestSort('cliente_nome')}
                  >
                    Cliente
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                  <TableSortLabel
                    active={orderBy === 'data_ultimo_pedido'}
                    direction={orderBy === 'data_ultimo_pedido' ? order : 'asc'}
                    onClick={() => handleRequestSort('data_ultimo_pedido')}
                  >
                    Data Último Pedido
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                  <TableSortLabel
                    active={orderBy === 'dias_desde_ultima_compra'}
                    direction={orderBy === 'dias_desde_ultima_compra' ? order : 'asc'}
                    onClick={() => handleRequestSort('dias_desde_ultima_compra')}
                  >
                    Dias da última compra
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                  <TableSortLabel
                    active={orderBy === 'oportunidade_recompra'}
                    direction={orderBy === 'oportunidade_recompra' ? order : 'asc'}
                    onClick={() => handleRequestSort('oportunidade_recompra')}
                  >
                    Oportunidade de Recompra
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.map((row) => {
                const dateObj = new Date(row.data_ultimo_pedido);
                // Adjust for timezone offset to show correct date
                dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
                const formattedDate = new Intl.DateTimeFormat('pt-BR').format(dateObj);

                return (
                  <TableRow hover key={row.cliente_code}>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal', wordWrap: 'break-word', minWidth: { xs: 120, md: 200 }, maxWidth: { xs: 150, md: 250 }, position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' }}>{row.cliente_nome}</TableCell>
                    <TableCell align="center">{formattedDate}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>{row.dias_desde_ultima_compra}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={row.oportunidade_recompra} 
                        color={getRecompraColor(row.oportunidade_recompra)}
                        size="small"
                        sx={{ 
                          fontWeight: 700, 
                          minWidth: 100,
                          ...(row.oportunidade_recompra === 'Crítico' ? { bgcolor: '#f44336', color: 'white' } : {}),
                          ...(row.oportunidade_recompra === 'Inativo' ? { bgcolor: '#e57373', color: 'white' } : {}),
                          ...(row.oportunidade_recompra === 'Desativado' ? { bgcolor: '#9e9e9e', color: 'white' } : {})
                        }} 
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

UltimosPedidos.getLayout = function getLayout(page: ReactElement) {
  return <PerformanceLayout>{page}</PerformanceLayout>;
};
