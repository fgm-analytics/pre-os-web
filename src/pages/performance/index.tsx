import React, { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Grid, Paper, Card, CardContent, 
  FormControl, InputLabel, Select, MenuItem, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab
} from '@mui/material';
import { usePerformanceContext } from '../../contexts/PerformanceContext';
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useRouter } from 'next/router';
import PerformanceLayout from '../../components/PerformanceLayout';
import { ReactElement } from 'react';

const parseDateString = (dateStr: string) => {
  if (!dateStr) return new Date(NaN);
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const [y, m] = parts.map(Number);
    if (isNaN(y) || isNaN(m)) return new Date(NaN);
    return new Date(y, m - 1, 1);
  }
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const getTrendIndicator = (valCurrent: number, valPrev: number | undefined) => {
  if (valPrev === undefined || valPrev <= 0) return null;
  const diff = valCurrent - valPrev;
  const percent = (diff / valPrev) * 100;
  const isUp = diff > 0;
  const isDown = diff < 0;
  
  if (percent === 0) return null;
  
  return (
    <Typography 
      component="span" 
      variant="caption" 
      sx={{ 
        color: isUp ? 'success.main' : 'error.main', 
        display: 'inline-flex', 
        alignItems: 'center',
        ml: 0.5,
        fontSize: '0.75rem',
        fontWeight: 600
      }}
    >
      {isUp ? '▲' : '▼'}{Math.abs(percent).toFixed(0)}%
    </Typography>
  );
};

export default function PerformanceDashboard() {
  const { 
    billingData, metaClienteProdutoData, performanceData, loading, error, 
    selectedClient, clientCodeInput, matchesSelectedSeller 
  } = usePerformanceContext();

  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    // Default to the first day of 3 months ago
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return firstDay.toISOString().slice(0, 7);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 7);
  });

  // Available years
  const years = useMemo(() => {
    const list = new Set<number>();
    billingData.forEach(r => {
      if (r.ano) list.add(r.ano);
    });
    // Ensure 2026 is visible
    list.add(2026);
    return Array.from(list).sort((a, b) => b - a);
  }, [billingData]);

  // Filtered data for general dashboard KPIs (respects startDate and endDate range)
  const filteredData = useMemo(() => {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const startY = isNaN(start.getTime()) ? 2026 : start.getFullYear();
    const startM = isNaN(start.getTime()) ? 1 : start.getMonth() + 1;
    const endY = isNaN(end.getTime()) ? 2026 : end.getFullYear();
    const endM = isNaN(end.getTime()) ? 12 : end.getMonth() + 1;

    return billingData.filter(r => {
      const matchSeller = matchesSelectedSeller(r);
      
      let matchClient = true;
      if (clientCodeInput.trim() !== '') {
        matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
      } else if (selectedClient !== 'todos') {
        matchClient = r.cliente_code === selectedClient;
      }

      const afterStart = r.ano > startY || (r.ano === startY && r.mes >= startM);
      const beforeEnd = r.ano < endY || (r.ano === endY && r.mes <= endM);
      const matchPeriod = afterStart && beforeEnd;

      return matchSeller && matchClient && matchPeriod;
    });
  }, [billingData, matchesSelectedSeller, selectedClient, clientCodeInput, startDate, endDate]);

  // Global totals
  const totals = useMemo(() => {
    let faturamento = 0;
    let volume = 0;
    filteredData.forEach(r => {
      faturamento += Number(r.realizado_faturamento || 0);
      volume += Number(r.realizado_volume || 0);
    });

    let metaFaturamento = 0;
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const startM = isNaN(start.getTime()) ? 1 : start.getMonth() + 1;
    const endM = isNaN(end.getTime()) ? 12 : end.getMonth() + 1;
    const startY = isNaN(start.getTime()) ? 2026 : start.getFullYear();
    const endY = isNaN(end.getTime()) ? 2026 : end.getFullYear();

    const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];

    const isGlobalMeta = selectedClient === 'todos' && clientCodeInput.trim() === '';

    if (isGlobalMeta) {
      performanceData.forEach(r => {
        if (!matchesSelectedSeller(r)) return;
        if (excludedGroups.includes(r.subgrupo)) return;
        const inYearRange = 2026 >= startY && 2026 <= endY;
        const matchPeriod = inYearRange && r.mes >= startM && r.mes <= endM;
        if (matchPeriod) {
          metaFaturamento += Number(r.meta_faturamento || 0);
        }
      });
    } else {
      metaClienteProdutoData.forEach(r => {
        if (!matchesSelectedSeller(r)) return;
        let matchClient = true;
        if (clientCodeInput.trim() !== '') {
          matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
        } else if (selectedClient !== 'todos') {
          matchClient = r.cliente_code === selectedClient;
        }
        
        const inYearRange = 2026 >= startY && 2026 <= endY;
        const matchPeriod = inYearRange && r.mes >= startM && r.mes <= endM;

        if (matchClient && matchPeriod) {
          metaFaturamento += Number(r.meta_faturamento || 0);
        }
      });
    }

    // Calcular Meta e Faturamento do Mês Atual baseada em todos os produtos do vendedor
    let metaMesAtual = 0;
    let faturamentoMesAtualGlobal = 0;
    const currentMonth = new Date().getMonth() + 1;
    
    performanceData.forEach(r => {
      if (matchesSelectedSeller(r) && r.mes === currentMonth && !excludedGroups.includes(r.subgrupo)) {
        metaMesAtual += Number(r.meta_faturamento || 0);
      }
    });

    billingData.forEach(r => {
      if (matchesSelectedSeller(r) && r.ano === 2026 && r.mes === currentMonth) {
        faturamentoMesAtualGlobal += Number(r.realizado_faturamento || 0);
      }
    });

    return { faturamento, volume, metaFaturamento, metaMesAtual, faturamentoMesAtualGlobal };
  }, [filteredData, metaClienteProdutoData, matchesSelectedSeller, selectedClient, clientCodeInput, startDate, endDate]);

  const { prevStartDate, prevEndDate } = useMemo(() => {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { prevStartDate: new Date(), prevEndDate: new Date() };
    }
    
    // Compare with exactly 1 year ago
    const pStart = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate());
    const pEnd = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
    
    return { prevStartDate: pStart, prevEndDate: pEnd };
  }, [startDate, endDate]);

  const previousFilteredData = useMemo(() => {
    const startY = prevStartDate.getFullYear();
    const startM = prevStartDate.getMonth() + 1;
    const endY = prevEndDate.getFullYear();
    const endM = prevEndDate.getMonth() + 1;

    return billingData.filter(r => {
      const matchSeller = matchesSelectedSeller(r);
      let matchClient = true;
      if (clientCodeInput.trim() !== '') {
        matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
      } else if (selectedClient !== 'todos') {
        matchClient = r.cliente_code === selectedClient;
      }
      const afterStart = r.ano > startY || (r.ano === startY && r.mes >= startM);
      const beforeEnd = r.ano < endY || (r.ano === endY && r.mes <= endM);
      const matchPeriod = afterStart && beforeEnd;
      return matchSeller && matchClient && matchPeriod;
    });
  }, [billingData, matchesSelectedSeller, selectedClient, clientCodeInput, prevStartDate, prevEndDate]);

  const previousTotals = useMemo(() => {
    let faturamento = 0;
    let volume = 0;
    previousFilteredData.forEach(r => {
      faturamento += Number(r.realizado_faturamento || 0);
      volume += Number(r.realizado_volume || 0);
    });
    return { faturamento, volume };
  }, [previousFilteredData]);

  // Filtered data for the comparative chart (all years covered by month range)
  const chartFilteredData = useMemo(() => {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const startM = isNaN(start.getTime()) ? 1 : start.getMonth() + 1;
    const endM = isNaN(end.getTime()) ? 12 : end.getMonth() + 1;

    return billingData.filter(r => {
      const matchSeller = matchesSelectedSeller(r);
      
      let matchClient = true;
      if (clientCodeInput.trim() !== '') {
        matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
      } else if (selectedClient !== 'todos') {
        matchClient = r.cliente_code === selectedClient;
      }

      // Overlaid comparison uses same month range across all years
      const matchPeriod = r.mes >= startM && r.mes <= endM;

      return matchSeller && matchClient && matchPeriod;
    });
  }, [billingData, matchesSelectedSeller, selectedClient, clientCodeInput, startDate, endDate]);

  // Monthly breakdown for comparative overlaid chart & table
  const chartData = useMemo(() => {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    const startM = isNaN(start.getTime()) ? 1 : start.getMonth() + 1;
    const endM = isNaN(end.getTime()) ? 12 : end.getMonth() + 1;

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const months = Array.from({ length: 12 }, (_, i) => {
      const obj: any = {
        mesNum: i + 1,
        name: monthNames[i]
      };
      // initialize all years
      years.forEach(y => {
        obj[y] = 0;
      });
      return obj;
    });

    chartFilteredData.forEach(r => {
      if (r.mes >= 1 && r.mes <= 12 && r.ano) {
        if (months[r.mes - 1][r.ano] !== undefined) {
          months[r.mes - 1][r.ano] += Number(r.realizado_faturamento || 0);
        }
      }
    });

    return months.filter(m => m.mesNum >= startM && m.mesNum <= endM);
  }, [chartFilteredData, years, startDate, endDate]);

  // Chronological faturamento timeline over the selected date range (sequential chart data)
  const periodChartData = useMemo(() => {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }

    const durationMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

    const data: any[] = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    let prev = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth(), 1);
    
    for (let count = 0; count < durationMonths && count < 200; count++) {
      const y = current.getFullYear();
      const m = current.getMonth() + 1;
      const label = `${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1]}/${String(y).slice(-2)}`;
      
      const py = prev.getFullYear();
      const pm = prev.getMonth() + 1;
      const pLabel = `${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][pm - 1]}/${String(py).slice(-2)}`;

      let faturamento = 0;
      let faturamentoPrev = 0;
      let meta = 0;

      billingData.forEach(r => {
        const matchSeller = matchesSelectedSeller(r);
        let matchClient = true;
        if (clientCodeInput.trim() !== '') {
          matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
        } else if (selectedClient !== 'todos') {
          matchClient = r.cliente_code === selectedClient;
        }
        
        if (matchSeller && matchClient) {
          if (r.ano === y && r.mes === m) {
            faturamento += Number(r.realizado_faturamento || 0);
          }
          if (r.ano === py && r.mes === pm) {
            faturamentoPrev += Number(r.realizado_faturamento || 0);
          }
        }
      });

      const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
      const isGlobalMeta = selectedClient === 'todos' && clientCodeInput.trim() === '';

      if (isGlobalMeta) {
        performanceData.forEach(r => {
          if (matchesSelectedSeller(r) && y === 2026 && r.mes === m && !excludedGroups.includes(r.subgrupo)) {
            meta += Number(r.meta_faturamento || 0);
          }
        });
      } else {
        metaClienteProdutoData.forEach(r => {
          if (!matchesSelectedSeller(r)) return;
          let matchClient = true;
          if (clientCodeInput.trim() !== '') {
            matchClient = r.cliente_code?.toLowerCase().includes(clientCodeInput.trim().toLowerCase());
          } else if (selectedClient !== 'todos') {
            matchClient = r.cliente_code === selectedClient;
          }
          
          if (matchClient && y === 2026 && r.mes === m) {
            meta += Number(r.meta_faturamento || 0);
          }
        });
      }
      
      data.push({
        name: label,
        prevName: pLabel,
        faturamento,
        faturamentoAnterior: faturamentoPrev,
        meta,
      });
      
      current.setMonth(current.getMonth() + 1);
      prev.setMonth(prev.getMonth() + 1);
    }
    
    return data;
  }, [billingData, metaClienteProdutoData, matchesSelectedSeller, selectedClient, clientCodeInput, startDate, endDate, prevStartDate]);

  // Client ranking
  const clientRanking = useMemo(() => {
    const clients: Record<string, { code: string; name: string; total: number }> = {};
    filteredData.forEach(r => {
      if (!clients[r.cliente_code]) {
        clients[r.cliente_code] = { code: r.cliente_code, name: r.cliente_nome, total: 0 };
      }
      clients[r.cliente_code].total += Number(r.realizado_faturamento || 0);
    });
    return Object.values(clients).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredData]);

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
        <title>Performance Comercial - Histórico</title>
      </Head>

      {/* Filters Specific to this Tab & Meta Summary */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            label="Mês Inicial"
            type="month"
            slotProps={{ inputLabel: { shrink: true } }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ minWidth: 150 }}
          />

          <TextField
            size="small"
            label="Mês Final"
            type="month"
            slotProps={{ inputLabel: { shrink: true } }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ minWidth: 150 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {totals.metaMesAtual > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', px: 2, py: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1, fontWeight: 500 }}>Meta Mês Atual:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', mr: 1 }}>{formatCurrency(totals.metaMesAtual)}</Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 700, 
                color: totals.faturamentoMesAtualGlobal >= totals.metaMesAtual ? 'success.main' : 'error.main' 
              }}>
                ({totals.faturamentoMesAtualGlobal >= totals.metaMesAtual ? '▲' : '▼'} {((totals.faturamentoMesAtualGlobal / totals.metaMesAtual) * 100).toFixed(1)}%)
              </Typography>
            </Box>
          )}

          {totals.metaFaturamento > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', px: 2, py: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1, fontWeight: 500 }}>Meta do Período:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mr: 1 }}>{formatCurrency(totals.metaFaturamento)}</Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 700, 
                color: totals.faturamento >= totals.metaFaturamento ? 'success.main' : 'error.main' 
              }}>
                ({totals.faturamento >= totals.metaFaturamento ? '▲' : '▼'} {((totals.faturamento / totals.metaFaturamento) * 100).toFixed(1)}%)
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Faturamento Realizado Total no Período
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                {formatCurrency(totals.faturamento)}
                {getTrendIndicator(totals.faturamento, previousTotals.faturamento)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Volume Total Faturado
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'secondary.main', display: 'flex', alignItems: 'center' }}>
                {totals.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} UN
                {getTrendIndicator(totals.volume, previousTotals.volume)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts & Details */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12 }}>
          {/* Sequential period timeline chart */}
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Histórico de faturamento no período</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <ComposedChart data={periodChartData}>
                <defs>
                  <linearGradient id="colorPeriod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007FFF" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#007FFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis 
                  stroke="#9CA3AF"
                  tickFormatter={(tick) => tick >= 1e6 ? `${(tick / 1e6).toFixed(1)}M` : tick >= 1e3 ? `${(tick / 1e3).toFixed(0)}k` : tick}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px' }}
                  formatter={(val: any, name: string, props: any) => {
                    if (name === 'Faturamento') return [formatCurrency(val), 'Atual (' + props.payload.name + ')'];
                    if (name === 'Anterior' || name === 'faturamentoAnterior') return [formatCurrency(val), 'Anterior (' + props.payload.prevName + ')'];
                    if (name === 'Meta') return [formatCurrency(val), 'Meta'];
                    return [val, name];
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="faturamentoAnterior" name="Anterior" fill="#4B5563" radius={[4, 4, 0, 0]} barSize={40} />
                <Area 
                  type="monotone" 
                  dataKey="faturamento" 
                  name="Faturamento" 
                  stroke="#007FFF" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorPeriod)" 
                />
                <Line 
                  type="monotone" 
                  dataKey="meta" 
                  name="Meta" 
                  stroke="#10B981" 
                  strokeWidth={2} 
                  dot={false} 
                  strokeDasharray="5 5" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

PerformanceDashboard.getLayout = function getLayout(page: ReactElement) {
  return <PerformanceLayout>{page}</PerformanceLayout>;
};
