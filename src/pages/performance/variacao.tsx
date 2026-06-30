/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent
} from '@mui/material';
import { usePerformanceContext } from '../../contexts/PerformanceContext';
import PerformanceLayout from '../../components/PerformanceLayout';
import { ReactElement } from 'react';

const formatCurrency = (val: number) => {
  if (val === 0) return 'R$ 0,00';
  if (!val) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatPercent = (val: number | null) => {
  if (val === null || !isFinite(val)) return '—';
  const signal = val > 0 ? '+' : '';
  return `${signal}${(val * 100).toFixed(2)}%`;
};

export default function VariacaoFaturamento() {
  const { billingData, clienteProdutoData, loading, error, matchesSelectedSeller } = usePerformanceContext();
  const [metric, setMetric] = useState<'variacao_rs' | 'variacao_perc'>('variacao_rs');
  
  // Extrair anos disponíveis
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    billingData.forEach(r => {
      if (r.ano) years.add(r.ano);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [billingData]);

  const defaultYear = availableYears.length > 0 ? availableYears[0] : 2026;
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'todos'>('todos');

  // Atualiza defaultYear se availableYears mudar
  React.useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const handleMetricChange = (
    event: React.MouseEvent<HTMLElement>,
    newMetric: 'variacao_rs' | 'variacao_perc',
  ) => {
    if (newMetric !== null) {
      setMetric(newMetric);
    }
  };

  const topVariations = useMemo(() => {
    const clientsMap = new Map<string, { nome: string; atual: number; anterior: number }>();
    const prevYear = selectedYear - 1;

    billingData.forEach(r => {
      if (!matchesSelectedSeller(r)) return;

      const isCurrentPeriod = r.ano === selectedYear && (selectedMonth === 'todos' || r.mes === selectedMonth);
      const isPrevPeriod = r.ano === prevYear && (selectedMonth === 'todos' || r.mes === selectedMonth);

      if (isCurrentPeriod || isPrevPeriod) {
        const key = r.cliente_code;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, { nome: r.cliente_nome || r.cliente_code, atual: 0, anterior: 0 });
        }
        const clientData = clientsMap.get(key)!;
        
        if (isCurrentPeriod) clientData.atual += Number(r.realizado_faturamento || 0);
        if (isPrevPeriod) clientData.anterior += Number(r.realizado_faturamento || 0);
      }
    });

    const variations = Array.from(clientsMap.entries()).map(([code, data]) => {
      const diff_rs = data.atual - data.anterior;
      const diff_perc = data.anterior > 0 ? diff_rs / data.anterior : (data.atual > 0 ? 1 : 0);
      
      return {
        code,
        nome: data.nome,
        atual: data.atual,
        anterior: data.anterior,
        diff_rs,
        diff_perc
      };
    });

    // Filtra casos onde ambos são 0
    const activeVariations = variations.filter(v => v.atual > 0 || v.anterior > 0);

    const sortFn = metric === 'variacao_rs' 
      ? (a: any, b: any) => b.diff_rs - a.diff_rs 
      : (a: any, b: any) => b.diff_perc - a.diff_perc;

    const sorted = [...activeVariations].sort(sortFn);

    const increases = sorted.filter(v => (metric === 'variacao_rs' ? v.diff_rs > 0 : v.diff_perc > 0));
    const decreases = [...activeVariations].filter(v => (metric === 'variacao_rs' ? v.diff_rs < 0 : v.diff_perc < 0)).sort((a, b) => {
      return metric === 'variacao_rs' ? a.diff_rs - b.diff_rs : a.diff_perc - b.diff_perc;
    });

    return {
      top10Aumento: increases.slice(0, 10),
      top10Queda: decreases.slice(0, 10)
    };
  }, [billingData, selectedYear, selectedMonth, metric, matchesSelectedSeller]);

  const topVariationsProdutos = useMemo(() => {
    const excludedGroups = ['Dentscare', 'Whiteness', 'Outros', 'Home Care', 'Dentscare\\', 'Whiteness\\'];
    const productsMap = new Map<string, { nome: string; atual: number; anterior: number }>();
    const prevYear = selectedYear - 1;

    clienteProdutoData.forEach(r => {
      if (!matchesSelectedSeller(r)) return;
      if (excludedGroups.includes(r.subgrupo)) return;

      const isCurrentPeriod = r.ano === selectedYear && (selectedMonth === 'todos' || r.mes === selectedMonth);
      const isPrevPeriod = r.ano === prevYear && (selectedMonth === 'todos' || r.mes === selectedMonth);

      if (isCurrentPeriod || isPrevPeriod) {
        const key = r.subgrupo;
        if (!productsMap.has(key)) {
          productsMap.set(key, { nome: r.subgrupo, atual: 0, anterior: 0 });
        }
        const productData = productsMap.get(key)!;
        
        if (isCurrentPeriod) productData.atual += Number(r.realizado_faturamento || 0);
        if (isPrevPeriod) productData.anterior += Number(r.realizado_faturamento || 0);
      }
    });

    const variations = Array.from(productsMap.entries()).map(([code, data]) => {
      const diff_rs = data.atual - data.anterior;
      const diff_perc = data.anterior > 0 ? diff_rs / data.anterior : (data.atual > 0 ? 1 : 0);
      
      return {
        code,
        nome: data.nome,
        atual: data.atual,
        anterior: data.anterior,
        diff_rs,
        diff_perc
      };
    });

    const activeVariations = variations.filter(v => v.atual > 0 || v.anterior > 0);

    const sortFn = metric === 'variacao_rs' 
      ? (a: any, b: any) => b.diff_rs - a.diff_rs 
      : (a: any, b: any) => b.diff_perc - a.diff_perc;

    const sorted = [...activeVariations].sort(sortFn);

    const increases = sorted.filter(v => (metric === 'variacao_rs' ? v.diff_rs > 0 : v.diff_perc > 0));
    const decreases = [...activeVariations].filter(v => (metric === 'variacao_rs' ? v.diff_rs < 0 : v.diff_perc < 0)).sort((a, b) => {
      return metric === 'variacao_rs' ? a.diff_rs - b.diff_rs : a.diff_perc - b.diff_perc;
    });

    return {
      top10Aumento: increases.slice(0, 10),
      top10Queda: decreases.slice(0, 10)
    };
  }, [clienteProdutoData, selectedYear, selectedMonth, metric, matchesSelectedSeller]);

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
        <title>Performance - Variação de Faturamento</title>
      </Head>

      {/* Local Filters */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 4, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Ano Atual</InputLabel>
            <Select
              value={selectedYear}
              label="Ano Atual"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map(ano => (
                <MenuItem key={ano} value={ano}>{ano}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Mês</InputLabel>
            <Select
              value={selectedMonth}
              label="Mês"
              onChange={(e) => setSelectedMonth(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            >
              <MenuItem value="todos">Todos os Meses</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                <MenuItem key={mes} value={mes}>
                  {new Date(2000, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <ToggleButtonGroup
          value={metric}
          exclusive
          onChange={handleMetricChange}
          color="primary"
          sx={{ bgcolor: 'background.paper' }}
          size="small"
        >
          <ToggleButton value="variacao_rs" sx={{ px: 3, fontWeight: 700 }}>
            Variação R$
          </ToggleButton>
          <ToggleButton value="variacao_perc" sx={{ px: 3, fontWeight: 700 }}>
            Variação %
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Data Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
        <Box>
          <Card elevation={3} sx={{ borderTop: '4px solid', borderColor: 'success.main', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                Top 10 Clientes com Aumento
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Atual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Anterior</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Variação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topVariations.top10Aumento.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nenhum cliente com aumento no período.</TableCell>
                      </TableRow>
                    ) : (
                      topVariations.top10Aumento.map((v, idx) => (
                        <TableRow key={v.code} hover>
                          <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${v.code} - ${v.nome}`}>
                            {idx + 1}. {v.nome}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(v.atual)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(v.anterior)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {metric === 'variacao_rs' ? `+${formatCurrency(v.diff_rs)}` : formatPercent(v.diff_perc)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        <Box>
          <Card elevation={3} sx={{ borderTop: '4px solid', borderColor: 'error.main', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'error.main' }}>
                Top 10 Clientes em Queda
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Atual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Anterior</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Variação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topVariations.top10Queda.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nenhum cliente com queda no período.</TableCell>
                      </TableRow>
                    ) : (
                      topVariations.top10Queda.map((v, idx) => (
                        <TableRow key={v.code} hover>
                          <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${v.code} - ${v.nome}`}>
                            {idx + 1}. {v.nome}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(v.atual)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(v.anterior)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                            {metric === 'variacao_rs' ? formatCurrency(v.diff_rs) : formatPercent(v.diff_perc)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Product Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mt: 4 }}>
        <Box>
          <Card elevation={3} sx={{ borderTop: '4px solid', borderColor: 'success.main', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                Top 10 Produtos com Aumento
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Produto</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Atual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Anterior</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Variação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topVariationsProdutos.top10Aumento.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nenhum produto com aumento no período.</TableCell>
                      </TableRow>
                    ) : (
                      topVariationsProdutos.top10Aumento.map((v, idx) => (
                        <TableRow key={v.code} hover>
                          <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.nome}>
                            {idx + 1}. {v.nome}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(v.atual)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(v.anterior)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {metric === 'variacao_rs' ? `+${formatCurrency(v.diff_rs)}` : formatPercent(v.diff_perc)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        <Box>
          <Card elevation={3} sx={{ borderTop: '4px solid', borderColor: 'error.main', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'error.main' }}>
                Top 10 Produtos em Queda
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Produto</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Atual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Período Anterior</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Variação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topVariationsProdutos.top10Queda.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nenhum produto com queda no período.</TableCell>
                      </TableRow>
                    ) : (
                      topVariationsProdutos.top10Queda.map((v, idx) => (
                        <TableRow key={v.code} hover>
                          <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.nome}>
                            {idx + 1}. {v.nome}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(v.atual)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(v.anterior)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                            {metric === 'variacao_rs' ? formatCurrency(v.diff_rs) : formatPercent(v.diff_perc)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

VariacaoFaturamento.getLayout = function getLayout(page: ReactElement) {
  return <PerformanceLayout>{page}</PerformanceLayout>;
};
