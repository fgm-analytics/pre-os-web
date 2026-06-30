import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import {
  Container,
  Typography,
  Tabs,
  Tab,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Snackbar,
  Alert
} from "@mui/material";
import { useAuth } from "../contexts/AuthProvider";
import { supabase } from "../lib/supabase";

interface SegregadoItem {
  produto_codigo: string;
  texto_breve_material: string;
  data_vencimento: string;
  quantidade_estoque: number;
  business_unit: string;
  categoria: string;
}

type Order = 'asc' | 'desc';

export default function Segregados() {
  const { user } = useAuth();
  
  const buKeys = ["Dentscare", "Whiteness", "Home_Care"];
  const [activeTab, setActiveTab] = useState<number>(0);
  const [dataByBU, setDataByBU] = useState<Record<string, SegregadoItem[]>>({
    Dentscare: [],
    Whiteness: [],
    Home_Care: []
  });

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof SegregadoItem>('data_vencimento');

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;

      const res = await fetch("/api/segregados", { headers });
      if (!res.ok) throw new Error("Falha ao buscar segregados");
      
      const data = await res.json();
      setDataByBU(data);
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : "Erro ao carregar dados", severity: "error" });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const handleRequestSort = (property: keyof SegregadoItem) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const getRowColor = (data_vencimento: string) => {
    if (!data_vencimento) return "inherit";
    
    const vencimento = new Date(data_vencimento);
    const hoje = new Date();
    
    // Calcula diferença em meses
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

    if (diffMonths <= 12) {
      return "#d32f2f"; // Dark Red (Segregado)
    } else if (diffMonths > 12 && diffMonths <= 14) {
      return "#ed6c02"; // Dark Orange/Yellow (Quase segregado)
    }
    return "inherit";
  };

  // Pega os itens da aba ativa e ordena
  const visibleRows = useMemo(() => {
    const activeBU = buKeys[activeTab];
    const rows = dataByBU[activeBU] || [];

    return rows.sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (orderBy === 'quantidade_estoque') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }

      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [dataByBU, activeTab, order, orderBy]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    // Para resolver problemas de fuso, extraimos de forma simples
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return `${parts[2].substring(0,2)}/${parts[1]}/${parts[0]}`;
    }
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <>
      <Head>
        <title>Segregados | FGM</title>
      </Head>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Itens Segregados e Quase Segregados
          </Typography>
        </Box>

        <Paper sx={{ mb: 4, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Dentscare" />
            <Tab label="Whiteness" />
            <Tab label="Home Care" />
          </Tabs>

          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'produto_codigo'}
                      direction={orderBy === 'produto_codigo' ? order : 'asc'}
                      onClick={() => handleRequestSort('produto_codigo')}
                    >
                      Código
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'texto_breve_material'}
                      direction={orderBy === 'texto_breve_material' ? order : 'asc'}
                      onClick={() => handleRequestSort('texto_breve_material')}
                    >
                      Produto
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">
                    <TableSortLabel
                      active={orderBy === 'data_vencimento'}
                      direction={orderBy === 'data_vencimento' ? order : 'asc'}
                      onClick={() => handleRequestSort('data_vencimento')}
                    >
                      Validade
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={orderBy === 'quantidade_estoque'}
                      direction={orderBy === 'quantidade_estoque' ? order : 'asc'}
                      onClick={() => handleRequestSort('quantidade_estoque')}
                    >
                      Estoque
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      Nenhum item segregado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow 
                      key={row.produto_codigo}
                      sx={{ 
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.05)'
                        }
                      }}
                    >
                      <TableCell>{row.produto_codigo}</TableCell>
                      <TableCell>{row.texto_breve_material || "N/D"}</TableCell>
                      <TableCell 
                        align="center" 
                        sx={{ 
                          backgroundColor: getRowColor(row.data_vencimento),
                          color: getRowColor(row.data_vencimento) !== "inherit" ? "#fff" : "inherit",
                          fontWeight: getRowColor(row.data_vencimento) !== "inherit" ? "bold" : "normal",
                          borderRadius: 1
                        }}
                      >
                        {formatDate(row.data_vencimento)}
                      </TableCell>
                      <TableCell align="right">{row.quantidade_estoque}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

      </Container>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
