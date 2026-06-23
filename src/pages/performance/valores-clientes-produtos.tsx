import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, TextField
} from '@mui/material';
import { usePerformanceContext } from '../../contexts/PerformanceContext';
import { useRouter } from 'next/router';
import PerformanceLayout from '../../components/PerformanceLayout';
import { ReactElement } from 'react';

const formatCurrency = (val: number) => {
  if (!val) return 'R$ -';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatVolume = (val: number) => {
  if (!val) return '0';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(val);
};

const formatPercent = (val: number | null) => {
  if (val === null || isNaN(val) || !isFinite(val)) return '0%';
  return `${(val * 100).toFixed(0)}%`;
};

const getStatus = (vol24: number, vol25: number, vol26: number) => {
  if (vol26 > 0) return { text: 'Compra', bg: '#dcfce7', color: '#166534' }; // green-100, green-800
  if (vol26 === 0 && (vol25 > 0 || vol24 > 0)) return { text: 'Não comprou este ano', bg: '#fef3c7', color: '#92400e' }; // amber-100, amber-800
  return { text: 'Não Compra', bg: '#fee2e2', color: '#991b1b' }; // red-100, red-800
};

export default function ValoresClientesProdutos() {
  const router = useRouter();
  const { 
    clienteProdutoData, metaClienteProdutoData, loading, error,
    matchesSelectedSeller, clients, selectedClient, clientCodeInput
  } = usePerformanceContext();

  const currentClientCode = useMemo(() => {
    if (clientCodeInput.trim() !== '') {
      // Find matching client by code partially
      const matched = clients.find(c => c.code.toLowerCase().includes(clientCodeInput.trim().toLowerCase()));
      return matched ? matched.code : clientCodeInput.trim();
    }
    return selectedClient !== 'todos' ? selectedClient : '';
  }, [clientCodeInput, selectedClient, clients]);

  const tableData = useMemo(() => {
    if (!currentClientCode) return { 
      rows: [], 
      totals: { vol24: 0, vol25: 0, vol26: 0, metaVol26: 0, pMetaAtingV: null, pCrescV: null, fat23: 0, fat24: 0, fat25: 0, fat26: 0, metaFat26: 0, pMetaAtingF: null, pCrescF: null } 
    };

    // Find distinct products (subgrupos) for the chosen seller (ignoring client filter to show all products)
    const productSet = new Set<string>();
    
    clienteProdutoData.forEach(r => {
      if (matchesSelectedSeller(r)) {
        productSet.add(r.subgrupo);
      }
    });
    metaClienteProdutoData.forEach(r => {
      if (matchesSelectedSeller(r)) {
        productSet.add(r.subgrupo);
      }
    });

    const products = Array.from(productSet).sort();
    
    let t_v24 = 0, t_v25 = 0, t_v26 = 0, t_m26_v = 0;
    let t_f23 = 0, t_f24 = 0, t_f25 = 0, t_f26 = 0, t_m26_f = 0;

    const rows = products.map(prod => {
      let vol24 = 0, vol25 = 0, vol26 = 0;
      let fat23 = 0, fat24 = 0, fat25 = 0, fat26 = 0;
      let metaVol26 = 0, metaFat26 = 0;

      clienteProdutoData.forEach(r => {
        if (matchesSelectedSeller(r) && r.cliente_code === currentClientCode && r.subgrupo === prod) {
          if (r.ano === 2024) { vol24 += Number(r.realizado_volume || 0); fat24 += Number(r.realizado_faturamento || 0); }
          if (r.ano === 2025) { vol25 += Number(r.realizado_volume || 0); fat25 += Number(r.realizado_faturamento || 0); }
          if (r.ano === 2026) { vol26 += Number(r.realizado_volume || 0); fat26 += Number(r.realizado_faturamento || 0); }
          if (r.ano === 2023) { fat23 += Number(r.realizado_faturamento || 0); }
        }
      });

      metaClienteProdutoData.forEach(r => {
        if (matchesSelectedSeller(r) && r.cliente_code === currentClientCode && r.subgrupo === prod) {
          if (r.mes >= 1 && r.mes <= 12) {
            metaVol26 += Number(r.meta_volume || 0);
            metaFat26 += Number(r.meta_faturamento || 0);
          }
        }
      });

      t_v24 += vol24; t_v25 += vol25; t_v26 += vol26; t_m26_v += metaVol26;
      t_f23 += fat23; t_f24 += fat24; t_f25 += fat25; t_f26 += fat26; t_m26_f += metaFat26;

      const pMetaAtingV = metaVol26 > 0 ? vol26 / metaVol26 : null;
      const pCrescV = vol25 > 0 ? (vol26 - vol25) / vol25 : null;

      const pMetaAtingF = metaFat26 > 0 ? fat26 / metaFat26 : null;
      const pCrescF = fat25 > 0 ? (fat26 - fat25) / fat25 : null;

      return {
        produto: prod,
        status: getStatus(vol24, vol25, vol26),
        vol24, vol25, vol26, metaVol26, pMetaAtingV, pCrescV,
        fat23, fat24, fat25, fat26, metaFat26, pMetaAtingF, pCrescF
      };
    });

    const totals = {
      vol24: t_v24, vol25: t_v25, vol26: t_v26, metaVol26: t_m26_v,
      pMetaAtingV: t_m26_v > 0 ? t_v26 / t_m26_v : null,
      pCrescV: t_v25 > 0 ? (t_v26 - t_v25) / t_v25 : null,
      fat23: t_f23, fat24: t_f24, fat25: t_f25, fat26: t_f26, metaFat26: t_m26_f,
      pMetaAtingF: t_m26_f > 0 ? t_f26 / t_m26_f : null,
      pCrescF: t_f25 > 0 ? (t_f26 - t_f25) / t_f25 : null
    };

    return { rows, totals };
  }, [currentClientCode, clienteProdutoData, metaClienteProdutoData, matchesSelectedSeller]);

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
        <title>Performance - Valores Clientes Produtos</title>
      </Head>

      {/* Client Context Banner */}
      {currentClientCode && clients.find(c => c.code === currentClientCode) && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1, boxShadow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {clients.find(c => c.code === currentClientCode)?.name}
          </Typography>
        </Box>
      )}

      {!currentClientCode ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Por favor, selecione um cliente no menu ou digite o código para visualizar os dados de performance de produtos.
        </Alert>
      ) : tableData.rows.length === 0 ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Nenhum dado encontrado para o cliente selecionado.
        </Alert>
      ) : (
        <Box sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
          <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', border: '1px solid', borderColor: 'divider', maxHeight: '70vh' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} sx={{ fontWeight: 700, minWidth: 200, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)', position: 'sticky', left: 0, zIndex: 3 }}>Produto</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ fontWeight: 700, minWidth: 150, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>Status do Cliente</TableCell>
                  
                  {/* Volume Headers */}
                  <TableCell colSpan={6} align="center" sx={{ fontWeight: 800, bgcolor: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                    Volume
                  </TableCell>
                  
                  {/* Valor Headers */}
                  <TableCell colSpan={7} align="center" sx={{ fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                    Valor
                  </TableCell>
                </TableRow>
                <TableRow>
                  {/* Volume sub-headers */}
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>2024</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>2025</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>2026</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>Meta 2026</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>% Meta Ating</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>% Cresc 25 x 26</TableCell>

                  {/* Valor sub-headers */}
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>2023</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>2024</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>2025</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>2026</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>Meta 2026</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>% Meta Ating</TableCell>
                  <TableCell align="center" sx={{ top: 35, zIndex: 2, fontWeight: 700, bgcolor: 'background.paper' }}>% Cresc 25 x 26</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Total Row */}
                <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)' }}>
                  <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' }}>Total</TableCell>
                  <TableCell></TableCell>

                  {/* Volume Totals */}
                  <TableCell align="center" sx={{ fontWeight: 800, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>{formatVolume(tableData.totals.vol24)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatVolume(tableData.totals.vol25)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatVolume(tableData.totals.vol26)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatVolume(tableData.totals.metaVol26)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tableData.totals.pMetaAtingV !== null && tableData.totals.pMetaAtingV >= 1 ? 'success.main' : 'warning.main' }}>
                    {tableData.totals.pMetaAtingV !== null ? formatPercent(tableData.totals.pMetaAtingV) : ''}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tableData.totals.pCrescV !== null && tableData.totals.pCrescV >= 0 ? 'success.main' : 'error.main' }}>
                    {tableData.totals.pCrescV !== null ? formatPercent(tableData.totals.pCrescV) : ''}
                  </TableCell>

                  {/* Valor Totals */}
                  <TableCell align="center" sx={{ fontWeight: 800, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>{formatCurrency(tableData.totals.fat23)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatCurrency(tableData.totals.fat24)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatCurrency(tableData.totals.fat25)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatCurrency(tableData.totals.fat26)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>{formatCurrency(tableData.totals.metaFat26)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tableData.totals.pMetaAtingF !== null && tableData.totals.pMetaAtingF >= 1 ? 'success.main' : 'warning.main' }}>
                    {tableData.totals.pMetaAtingF !== null ? formatPercent(tableData.totals.pMetaAtingF) : ''}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: tableData.totals.pCrescF !== null && tableData.totals.pCrescF >= 0 ? 'success.main' : 'error.main' }}>
                    {tableData.totals.pCrescF !== null ? formatPercent(tableData.totals.pCrescF) : ''}
                  </TableCell>
                </TableRow>

                {/* Data Rows */}
                {tableData.rows.map((row) => (
                  <TableRow key={row.produto} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' }}>{row.produto}</TableCell>
                    <TableCell align="center" sx={{ p: 1 }}>
                      <Box sx={{ 
                        bgcolor: row.status.bg, 
                        color: row.status.color, 
                        py: 0.5, px: 1, 
                        borderRadius: 1, 
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        textAlign: 'center'
                      }}>
                        {row.status.text}
                      </Box>
                    </TableCell>

                    {/* Volume Data */}
                    <TableCell align="center" sx={{ borderLeft: '2px solid rgba(255,255,255,0.1)' }}>{formatVolume(row.vol24)}</TableCell>
                    <TableCell align="center">{formatVolume(row.vol25)}</TableCell>
                    <TableCell align="center">{formatVolume(row.vol26)}</TableCell>
                    <TableCell align="center">{formatVolume(row.metaVol26)}</TableCell>
                    <TableCell align="center" sx={{ color: row.pMetaAtingV !== null && row.pMetaAtingV >= 1 ? 'success.main' : 'warning.main', fontWeight: 600 }}>
                      {row.pMetaAtingV !== null ? formatPercent(row.pMetaAtingV) : ''}
                    </TableCell>
                    <TableCell align="center" sx={{ color: row.pCrescV !== null && row.pCrescV >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                      {row.pCrescV !== null ? formatPercent(row.pCrescV) : ''}
                    </TableCell>

                    {/* Valor Data */}
                    <TableCell align="center" sx={{ borderLeft: '2px solid rgba(255,255,255,0.1)' }}>{formatCurrency(row.fat23)}</TableCell>
                    <TableCell align="center">{formatCurrency(row.fat24)}</TableCell>
                    <TableCell align="center">{formatCurrency(row.fat25)}</TableCell>
                    <TableCell align="center">{formatCurrency(row.fat26)}</TableCell>
                    <TableCell align="center">{formatCurrency(row.metaFat26)}</TableCell>
                    <TableCell align="center" sx={{ color: row.pMetaAtingF !== null && row.pMetaAtingF >= 1 ? 'success.main' : 'warning.main', fontWeight: 600 }}>
                      {row.pMetaAtingF !== null ? formatPercent(row.pMetaAtingF) : ''}
                    </TableCell>
                    <TableCell align="center" sx={{ color: row.pCrescF !== null && row.pCrescF >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                      {row.pCrescF !== null ? formatPercent(row.pCrescF) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

ValoresClientesProdutos.getLayout = function getLayout(page: ReactElement) {
  return <PerformanceLayout>{page}</PerformanceLayout>;
};
