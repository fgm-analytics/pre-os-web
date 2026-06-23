import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { usePerformanceData } from '../../hooks/usePerformanceData';
import { useRouter } from 'next/router';

const formatCurrency = (val: number) => {
  if (!val) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatVolume = (val: number) => {
  if (!val) return '';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(val);
};

const formatPercent = (val: number | null) => {
  if (val === null) return '';
  return `${(val * 100).toFixed(2)}%`;
};

export default function FaturadoVendedorMes() {
  const router = useRouter();
  const { performanceData, loading, error } = usePerformanceData();
  const [metric, setMetric] = useState<'valor' | 'volume'>('valor');

  const handleMetricChange = (
    event: React.MouseEvent<HTMLElement>,
    newMetric: 'valor' | 'volume',
  ) => {
    if (newMetric !== null) {
      setMetric(newMetric);
    }
  };

  const formatValue = metric === 'valor' ? formatCurrency : formatVolume;

  // Group by Subgrupo + Mês
  const tableData = useMemo(() => {
    const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
    const subgroups = Array.from(new Set(performanceData.map(r => r.subgrupo)))
      .filter(s => !excludedGroups.includes(s))
      .sort();

    const rows: any[] = [];
    const quarters = Array.from({ length: 4 }, () => ({ meta: 0, realizado: 0 }));
    let totalAnoMeta = 0;
    let totalAnoRealizado = 0;

    subgroups.forEach(subg => {
      const monthValues = Array.from({ length: 12 }, () => ({
        meta: 0,
        realizado: 0
      }));

      performanceData.forEach(r => {
        if (r.subgrupo === subg && r.mes >= 1 && r.mes <= 12) {
          const meta = metric === 'valor' ? Number(r.meta_faturamento || 0) : Number(r.meta_volume || 0);
          const realizado = metric === 'valor' ? Number(r.realizado_faturamento || 0) : Number(r.realizado_volume || 0);
          monthValues[r.mes - 1].meta += meta;
          monthValues[r.mes - 1].realizado += realizado;
        }
      });

      let subTotalMeta = 0;
      let subTotalRealizado = 0;

      monthValues.forEach((m, i) => {
        subTotalMeta += m.meta;
        subTotalRealizado += m.realizado;
      });

      rows.push({
        subgrupo: subg,
        meses: monthValues,
        totalMeta: subTotalMeta,
        totalRealizado: subTotalRealizado
      });
    });

    const totalMeses = Array.from({ length: 12 }, () => ({ meta: 0, realizado: 0 }));

    rows.forEach(r => {
      r.meses.forEach((m: any, idx: number) => {
        totalMeses[idx].meta += m.meta;
        totalMeses[idx].realizado += m.realizado;
        
        // Populate quarters
        const qIdx = Math.floor(idx / 3);
        quarters[qIdx].meta += m.meta;
        quarters[qIdx].realizado += m.realizado;
      });
      totalAnoMeta += r.totalMeta;
      totalAnoRealizado += r.totalRealizado;
    });

    // Accumulated to current month (assuming all months for now or up to current month if we had a filter, 
    // but the spreadsheet says "Valor Acumulado 2026", which is often the same as Year to Date or Total Year)
    // Here we will just use the yearly total for the Accumulated columns to match Excel's "Acumulado" 
    // which usually means the sum up to the latest month with data, but without a specific month filter, it's the sum.
    
    return {
      subgroups: rows,
      totals: {
        meses: totalMeses,
        totalMeta: totalAnoMeta,
        totalRealizado: totalAnoRealizado,
        quarters
      }
    };
  }, [performanceData, metric]);

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
        <title>Performance - Faturado Vendedor Mês</title>
      </Head>

      {/* Tabs */}
      <Tabs 
        value={1} 
        onChange={(_, val) => {
          if (val === 0) router.push('/performance');
        }}
        sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Menu Histórico" sx={{ fontWeight: 700 }} />
        <Tab label="Faturado Vendedor Mês" sx={{ fontWeight: 700 }} />
      </Tabs>

      {/* Top Summary Table & Toggle */}
      <Box sx={{ display: 'flex', gap: 4, mb: 4, alignItems: 'flex-start' }}>
        <TableContainer component={Paper} sx={{ width: 'auto', border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <TableCell></TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>1º Trimestre</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>2º Trimestre</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>3º Trimestre</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>4º Trimestre</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Total Ano</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Realizado</TableCell>
                {tableData.totals.quarters.map((q: any, i: number) => {
                  const isQSuccess = q.meta > 0 && q.realizado >= q.meta;
                  const isQWarning = q.meta > 0 && q.realizado < q.meta;
                  const qColor = isQSuccess ? 'success.main' : isQWarning ? 'warning.main' : 'inherit';
                  return (
                    <TableCell key={i} align="right" sx={{ color: qColor }}>{formatValue(q.realizado)}</TableCell>
                  );
                })}
                {(() => {
                  const totR = tableData.totals.totalRealizado;
                  const totM = tableData.totals.totalMeta;
                  const isTotSuccess = totM > 0 && totR >= totM;
                  const isTotWarning = totM > 0 && totR < totM;
                  const totColor = isTotSuccess ? 'success.main' : isTotWarning ? 'warning.main' : 'inherit';
                  return (
                    <TableCell align="right" sx={{ fontWeight: 700, color: totColor }}>{formatValue(totR)}</TableCell>
                  );
                })()}
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Meta</TableCell>
                {tableData.totals.quarters.map((q: any, i: number) => (
                  <TableCell key={i} align="right">{formatValue(q.meta)}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatValue(tableData.totals.totalMeta)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>% Ating</TableCell>
                {tableData.totals.quarters.map((q: any, i: number) => {
                  const ating = q.meta > 0 ? q.realizado / q.meta : null;
                  return (
                    <TableCell key={i} align="right" sx={{ color: ating !== null && ating >= 1 ? 'success.main' : 'warning.main' }}>
                      {formatPercent(ating)}
                    </TableCell>
                  );
                })}
                <TableCell align="right" sx={{ fontWeight: 700, color: tableData.totals.totalMeta > 0 && tableData.totals.totalRealizado / tableData.totals.totalMeta >= 1 ? 'success.main' : 'warning.main' }}>
                  {formatPercent(tableData.totals.totalMeta > 0 ? tableData.totals.totalRealizado / tableData.totals.totalMeta : null)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ToggleButtonGroup
            value={metric}
            exclusive
            onChange={handleMetricChange}
            aria-label="metric toggle"
            color="primary"
            sx={{ bgcolor: 'background.paper' }}
          >
            <ToggleButton value="volume" sx={{ px: 4, fontWeight: 700 }}>
              Volume
            </ToggleButton>
            <ToggleButton value="valor" sx={{ px: 4, fontWeight: 700 }}>
              Valor
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Monthly Table */}
      <Box sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Visão Mensal (2026)</Typography>
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', border: '1px solid', borderColor: 'divider', maxHeight: '60vh' }}>
          <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ fontWeight: 700, minWidth: 200, whiteSpace: 'nowrap', bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                Grupo de Produto | Mês
              </TableCell>
              {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(m => (
                <TableCell key={m} colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {m}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              {Array.from({ length: 12 }, (_, i) => (
                <React.Fragment key={i}>
                  <TableCell align="right" sx={{ top: 35, zIndex: 2, fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>Realizado</TableCell>
                  <TableCell align="right" sx={{ top: 35, zIndex: 2, fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>Meta</TableCell>
                </React.Fragment>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Total Row */}
            <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)' }}>
              <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>Total</TableCell>
              {tableData.totals.meses.map((m: any, idx: number) => {
                const isRealizadoSuccess = m.meta > 0 && m.realizado >= m.meta;
                const isRealizadoWarning = m.meta > 0 && m.realizado < m.meta;
                const mColor = isRealizadoSuccess ? 'success.main' : isRealizadoWarning ? 'warning.main' : 'inherit';
                return (
                  <React.Fragment key={idx}>
                    <TableCell align="right" sx={{ fontWeight: 700, color: mColor, whiteSpace: 'nowrap' }}>{formatValue(m.realizado)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatValue(m.meta)}</TableCell>
                  </React.Fragment>
                );
              })}
            </TableRow>

            {/* Subgroups Rows */}
            {tableData.subgroups.map((sub, sIdx) => {
              return (
                <TableRow key={sub.subgrupo} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{sub.subgrupo}</TableCell>
                  {sub.meses.map((m: any, idx: number) => {
                    const isMSuccess = m.meta > 0 && m.realizado >= m.meta;
                    const isMWarning = m.meta > 0 && m.realizado < m.meta;
                    const mColor = isMSuccess ? 'success.main' : isMWarning ? 'warning.main' : 'inherit';
                    return (
                      <React.Fragment key={idx}>
                        <TableCell align="right" sx={{ color: mColor, whiteSpace: 'nowrap' }}>{m.realizado !== 0 ? formatValue(m.realizado) : ''}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{m.meta !== 0 ? formatValue(m.meta) : ''}</TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      </Box>

      {/* Accumulated Table */}
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Visão Acumulada & Metas (2026)</Typography>
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto', border: '1px solid', borderColor: 'divider', maxHeight: '60vh' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 200, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  Grupo de Produto
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  {metric === 'valor' ? 'Valor' : 'Volume'} Acumulado 2026
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  {metric === 'valor' ? 'Valor' : 'Volume'} Meta Acumulado 2026
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  % Ating Acumulado
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  {metric === 'valor' ? 'Valor' : 'Volume'} Meta 2026
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  % Ating 2026
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Total Row */}
              <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)' }}>
                <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>Total</TableCell>
                {(() => {
                  const totReal = tableData.totals.totalRealizado;
                  const totMeta = tableData.totals.totalMeta;
                  const isTotSuccess = totMeta > 0 && totReal >= totMeta;
                  const isTotWarning = totMeta > 0 && totReal < totMeta;
                  const totColor = isTotSuccess ? 'success.main' : isTotWarning ? 'warning.main' : 'inherit';
                  
                  return (
                    <>
                      <TableCell align="right" sx={{ fontWeight: 800, color: totColor, whiteSpace: 'nowrap' }}>{formatValue(totReal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{formatValue(totMeta)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: totColor, whiteSpace: 'nowrap' }}>
                        {formatPercent(totMeta > 0 ? totReal / totMeta : null)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{formatValue(totMeta)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: totColor, whiteSpace: 'nowrap' }}>
                        {formatPercent(totMeta > 0 ? totReal / totMeta : null)}
                      </TableCell>
                    </>
                  );
                })()}
              </TableRow>

              {/* Subgroups Rows */}
              {tableData.subgroups.map((sub, sIdx) => {
                const atingTotal = sub.totalMeta > 0 ? sub.totalRealizado / sub.totalMeta : null;
                const isAtingSuccess = atingTotal !== null && atingTotal >= 1;
                const atingColor = atingTotal === null ? 'text.secondary' : isAtingSuccess ? 'success.main' : 'warning.main';

                return (
                  <TableRow key={sub.subgrupo} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{sub.subgrupo}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: atingColor, whiteSpace: 'nowrap' }}>{sub.totalRealizado !== 0 ? formatValue(sub.totalRealizado) : ''}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{sub.totalMeta !== 0 ? formatValue(sub.totalMeta) : ''}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: atingColor, whiteSpace: 'nowrap' }}>{formatPercent(atingTotal)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{sub.totalMeta !== 0 ? formatValue(sub.totalMeta) : ''}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: atingColor, whiteSpace: 'nowrap' }}>{formatPercent(atingTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
