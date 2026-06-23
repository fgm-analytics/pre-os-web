import React, { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Grid, Paper, Card, CardContent, 
  FormControl, InputLabel, Select, MenuItem, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Tabs, Tab
} from '@mui/material';
import { useAuth } from '../../contexts/AuthProvider';
import { usePerformanceData, BillingRecord } from '../../hooks/usePerformanceData';
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const { profile } = useAuth();
  const { billingData, loading, error } = usePerformanceData();

  const [selectedSeller, setSelectedSeller] = useState<string>('todos');
  const [selectedClient, setSelectedClient] = useState<string>('todos');
  const [clientCodeInput, setClientCodeInput] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-12-31');

  // For vendedor role: filter by vendedor_code directly from profile (no name matching needed)
  const isVendedor = profile?.role === 'vendedor';
  const profileVendedorCode = profile?.vendedor_code ?? null;

  // Helper: match seller for a given row (uses vendedor_code for vendedor role, nome for admin/gerente)
  // IMPORTANT: declared before any useMemo that depends on it to avoid ReferenceError
  const matchesSelectedSeller = (r: { vendedor_code: number; vendedor_nome: string }) => {
    if (isVendedor) {
      return profileVendedorCode !== null && Number(r.vendedor_code) === Number(profileVendedorCode);
    }
    return selectedSeller === 'todos' || r.vendedor_nome === selectedSeller;
  };

  // Available sellers from RLS visible data (only used for admin/gerente dropdown)
  const sellers = useMemo(() => {
    const list = new Set<string>();
    billingData.forEach(r => {
      if (r.vendedor_nome) list.add(r.vendedor_nome);
    });
    return Array.from(list).sort();
  }, [billingData]);

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

  // Clients in selected seller's portfolio
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

  // Filtered data for general dashboard KPIs (respects startDate and endDate range)
  const filteredData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
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
  }, [billingData, isVendedor, profileVendedorCode, selectedSeller, selectedClient, clientCodeInput, startDate, endDate]);

  // Global totals
  const totals = useMemo(() => {
    let faturamento = 0;
    let volume = 0;
    filteredData.forEach(r => {
      faturamento += Number(r.realizado_faturamento || 0);
      volume += Number(r.realizado_volume || 0);
    });
    return { faturamento, volume };
  }, [filteredData]);

  const { prevStartDate, prevEndDate } = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { prevStartDate: new Date(), prevEndDate: new Date() };
    }
    
    // Duration in months
    const durationMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    
    const pEnd = new Date(start.getFullYear(), start.getMonth(), 0); // last day of previous month
    const pStart = new Date(pEnd.getFullYear(), pEnd.getMonth() - durationMonths + 1, 1);
    
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
  }, [billingData, isVendedor, profileVendedorCode, selectedSeller, selectedClient, clientCodeInput, prevStartDate, prevEndDate]);

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
    const start = new Date(startDate);
    const end = new Date(endDate);
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
  }, [billingData, isVendedor, profileVendedorCode, selectedSeller, selectedClient, clientCodeInput, startDate, endDate]);

  // Monthly breakdown for comparative overlaid chart & table
  const chartData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    
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
      
      data.push({
        name: label,
        prevName: pLabel,
        faturamento,
        faturamentoAnterior: faturamentoPrev,
      });
      
      current.setMonth(current.getMonth() + 1);
      prev.setMonth(prev.getMonth() + 1);
    }
    
    return data;
  }, [billingData, isVendedor, profileVendedorCode, selectedSeller, selectedClient, clientCodeInput, startDate, endDate, prevStartDate]);

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

      {/* Tabs */}
      <Tabs 
        value={0} 
        onChange={(_, val) => {
          if (val === 1) router.push('/performance/faturamento');
        }}
        sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Menu Histórico" sx={{ fontWeight: 700 }} />
        <Tab label="Faturado Vendedor Mês" sx={{ fontWeight: 700 }} />
      </Tabs>

      {/* Filters */}
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
              <MenuItem value="todos">Todos os Vendedores</MenuItem>
              {sellers.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

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

        <TextField
          size="small"
          label="Data Inicial"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          sx={{ minWidth: 150 }}
        />

        <TextField
          size="small"
          label="Data Final"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          sx={{ minWidth: 150 }}
        />
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
                    if (name === 'faturamentoAnterior') return [formatCurrency(val), 'Anterior (' + props.payload.prevName + ')'];
                    return [val, name];
                  }}
                />
                <Bar dataKey="faturamentoAnterior" fill="#4B5563" radius={[4, 4, 0, 0]} barSize={40} />
                <Area 
                  type="monotone" 
                  dataKey="faturamento" 
                  name="Faturamento" 
                  stroke="#007FFF" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorPeriod)" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
