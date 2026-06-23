import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab, TableSortLabel, Chip
} from '@mui/material';
import { usePerformanceData, UltimosPedidosRecord } from '../../hooks/usePerformanceData';
import { useRouter } from 'next/router';

type Order = 'asc' | 'desc';

export default function UltimosPedidos() {
  const router = useRouter();
  const { ultimosPedidosData, loading, error } = usePerformanceData();
  
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

    return [...ultimosPedidosData].sort(comparator);
  }, [ultimosPedidosData, order, orderBy]);

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

      {/* Tabs */}
      <Tabs 
        value={3} 
        onChange={(_, val) => {
          if (val === 0) router.push('/performance');
          if (val === 1) router.push('/performance/faturamento');
          if (val === 2) router.push('/performance/valores-clientes-produtos');
        }}
        sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Menu Histórico" sx={{ fontWeight: 700 }} />
        <Tab label="Faturado Vendedor Mês" sx={{ fontWeight: 700 }} />
        <Tab label="Valores Clientes Produtos" sx={{ fontWeight: 700 }} />
        <Tab label="Últimos Pedidos" sx={{ fontWeight: 700 }} />
      </Tabs>

      <Typography variant="h5" sx={{ mb: 3, fontWeight: 800 }}>
        Últimos Pedidos por Cliente
      </Typography>

      <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <TableContainer sx={{ maxHeight: '70vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
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
                    <TableCell sx={{ fontWeight: 600 }}>{row.cliente_nome}</TableCell>
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
