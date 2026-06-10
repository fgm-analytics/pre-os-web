// Planilha de Preços Web - FGM
import { useState, useEffect, useMemo, useRef } from "react";
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
  TextField,
  Button,
  Divider,
  InputAdornment,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExcelJS from "exceljs";

// Cores mapeadas para o design escuro premium
const colorMap: Record<string, string> = {
  green: "#34d399",      // Emerald claro
  purple: "#c084fc",     // Purple claro
  red: "#f87171",        // Red claro
  blue: "#60a5fa",       // Blue claro
  cyan: "#22d3ee",       // Cyan claro
  dark_green: "#10b981", // Emerald médio
  brown: "#fbbf24",      // Amber claro
  dark_gray: "#9ca3af",  // Cinza claro
  navy: "#c084fc",     // Navy
  olive: "#34d399",  //Olive
  orange: "#fbbf24",  //Orange
  light_blue: "#34d399" //Light Blue
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

interface Product {
  codigo: string;
  material: string;
  categoria: string;
  cor?: string;
  businessUnit?: string;
  promotionName?: string;
  promotionIsActive?: boolean;
}

interface CartItem {
  quantidade: number;
  desconto: number;
  bonificados: number;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = localStorage.getItem("temp_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "sean.quadros@fgmdentalgroup.com" && password === "1729") {
      setIsAuthenticated(true);
      localStorage.setItem("temp_auth", "true");
      setLoginError("");
    } else {
      setLoginError("E-mail ou senha incorretos.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("temp_auth");
  };

  // Estado de Perfil (Vendedor ou Administrador)
  const [role, setRole] = useState<"vendedor" | "administrador">("vendedor");

  // Abas do Vendedor ("Dentscare", "Home_Care", "Whiteness")
  const [vendedorTab, setVendedorTab] = useState<number>(0);
  const buKeys = ["Dentscare", "Home_Care", "Whiteness"];

  // Dados brutos
  const [productsByBU, setProductsByBU] = useState<Record<string, Product[]>>({
    Dentscare: [],
    Home_Care: [],
    Whiteness: [],
  });

  // Tabela de Preços (Código -> Preço)
  const [prices, setPrices] = useState<Record<string, number>>({});
  // Edições temporárias de preços no perfil administrador
  const [tempPrices, setTempPrices] = useState<Record<string, number>>({});

  // Itens de Pedido (Aba -> Código -> Dados)
  const [cart, setCart] = useState<Record<string, Record<string, CartItem>>>({
    Dentscare: {},
    Home_Care: {},
    Whiteness: {},
  });

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");

  // Estados de UI/Feedback
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Diálogos de Inconsistência
  const [inconsistencyDialog, setInconsistencyDialog] = useState<{
    open: boolean;
    title: string;
    list: string[];
  }>({
    open: false,
    title: "",
    list: [],
  });

  // Referências para input de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefOrder = useRef<HTMLInputElement>(null);

  // Carregar produtos e preços
  const loadData = async () => {
    try {
      const prodRes = await fetch("/api/produtos");
      const prodData = await prodRes.json();

      // Mapear businessUnit para os itens para fácil rastreabilidade
      const mappedBU: Record<string, Product[]> = {};
      Object.keys(prodData).forEach((bu) => {
        mappedBU[bu] = prodData[bu].map((p: any) => ({ ...p, businessUnit: bu }));
      });
      setProductsByBU(mappedBU);

      const priceRes = await fetch("/api/precos");
      const priceData = await priceRes.json();
      setPrices(priceData);
      setTempPrices(priceData);
    } catch (err) {
      showMsg("Erro ao carregar dados do servidor.", "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMsg = (message: string, severity: "success" | "error" | "warning" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // Obter a lista de todos os produtos consolidados para busca ou admin
  const allProducts = useMemo(() => {
    return [
      ...productsByBU.Dentscare,
      ...productsByBU.Home_Care,
      ...productsByBU.Whiteness,
    ];
  }, [productsByBU]);

  // Filtrar produtos conforme pesquisa
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      if (role === "administrador") return allProducts;
      return (productsByBU[buKeys[vendedorTab]] || []).filter((p) => p.promotionIsActive !== false);
    }
    const baseList = role === "administrador" ? allProducts : (productsByBU[buKeys[vendedorTab]] || []).filter((p) => p.promotionIsActive !== false);
    return baseList.filter(
      (p) =>
        p.codigo.includes(query) ||
        p.material.toLowerCase().includes(query) ||
        p.categoria.toLowerCase().includes(query)
    );
  }, [role, vendedorTab, productsByBU, allProducts, searchQuery]);

  // Manipulação de Pedido (Vendedor)
  const handleCartChange = (bu: string, code: string, field: keyof CartItem, val: number) => {
    setCart((prev) => {
      const buCart = { ...prev[bu] };
      const currentItem = buCart[code] || { quantidade: 0, desconto: 0, bonificados: 0 };

      const updated = {
        ...currentItem,
        [field]: val >= 0 ? val : 0,
      };

      // Remover item se tudo zerar
      if (updated.quantidade === 0 && updated.desconto === 0 && updated.bonificados === 0) {
        delete buCart[code];
      } else {
        buCart[code] = updated;
      }

      return {
        ...prev,
        [bu]: buCart,
      };
    });
  };

  // Limpar formulário do pedido atual
  const clearCurrentOrder = () => {
    const bu = buKeys[vendedorTab];
    setCart((prev) => ({
      ...prev,
      [bu]: {},
    }));
    showMsg(`Pedido da aba ${bu} foi limpo.`);
  };

  // Copiar Pedido para o Clipboard (Apenas Código\tQuantidade)
  const handleCopyOrder = () => {
    const bu = buKeys[vendedorTab];
    const buCart = cart[bu] || {};

    // Obter itens com quantidade > 0 pertencentes a esta aba
    const itemsToCopy = Object.entries(buCart)
      .filter(([_, data]) => data.quantidade > 0)
      .map(([code, data]) => `${code}\t${data.quantidade}`);

    if (itemsToCopy.length === 0) {
      showMsg("Não há itens com quantidade maior que zero para copiar nesta aba.", "warning");
      return;
    }

    const textToCopy = itemsToCopy.join("\r\n");
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        showMsg(`Pedido ${bu} copiado para a área de transferência!`);
      })
      .catch(() => {
        showMsg("Falha ao copiar pedido.", "error");
      });
  };

  // Exportar Pedido para Excel
  const handleExportOrder = async () => {
    const bu = buKeys[vendedorTab];
    const buCart = cart[bu] || {};
    const buProducts = productsByBU[bu] || [];

    // Gerar dados para exportar
    const rows = buProducts.map((p) => {
      const cItem = buCart[p.codigo] || { quantidade: 0, desconto: 0, bonificados: 0 };
      const isSobConsulta = bu === "Home_Care" || bu === "Whiteness";
      const tablePrice = isSobConsulta ? 0 : (prices[p.codigo] || 0);
      const totalPrice = isSobConsulta ? 0 : tablePrice * (1 - cItem.desconto / 100);
      return {
        aba: bu,
        codigo: p.codigo,
        produto: p.material,
        promocao: p.promotionName || "-",
        categoria: p.categoria,
        preco_tabela: isSobConsulta ? "Sob consulta" : tablePrice,
        quantidade: cItem.quantidade,
        desconto: cItem.desconto,
        preco_total: isSobConsulta ? "Sob consulta" : totalPrice,
        bonificados: cItem.bonificados,
      };
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Pedido ${bu}`);

    worksheet.columns = [
      { header: "aba", key: "aba", width: 15 },
      { header: "codigo", key: "codigo", width: 15 },
      { header: "produto", key: "produto", width: 40 },
      { header: "promocao", key: "promocao", width: 25 },
      { header: "categoria", key: "categoria", width: 20 },
      { header: "preco_tabela", key: "preco_tabela", width: 15 },
      { header: "quantidade", key: "quantidade", width: 12 },
      { header: "desconto", key: "desconto", width: 12 },
      { header: "preco_total", key: "preco_total", width: 15 },
      { header: "bonificados", key: "bonificados", width: 12 },
    ];

    rows.forEach((r) => worksheet.addRow(r));

    // Estilizar cabeçalho
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo
    };
    worksheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pedido_${bu}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(`Pedido da aba ${bu} exportado com sucesso!`);
  };

  // Importar Pedido via Excel
  const handleImportOrder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const inconsistencies: string[] = [];
        const currentBU = buKeys[vendedorTab];
        const buProducts = productsByBU[currentBU] || [];
        const buCodesSet = new Set(buProducts.map((p) => p.codigo));

        // Encontrar os índices das colunas corretas
        let colIndexCodigo = -1;
        let colIndexQtd = -1;
        let colIndexDesc = -1;
        let colIndexBonif = -1;

        const firstRow = worksheet.getRow(1);
        firstRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().toLowerCase().trim();
          if (val === "codigo") colIndexCodigo = colNum;
          if (val === "quantidade") colIndexQtd = colNum;
          if (val === "desconto") colIndexDesc = colNum;
          if (val === "bonificados") colIndexBonif = colNum;
        });

        if (colIndexCodigo === -1 || colIndexQtd === -1) {
          showMsg("Layout inválido. Colunas 'codigo' e 'quantidade' são obrigatórias.", "error");
          return;
        }

        const newCartItems: Record<string, CartItem> = {};

        worksheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return; // pular cabeçalho

          const codeVal = row.getCell(colIndexCodigo).value;
          const code = codeVal ? codeVal.toString().trim() : "";
          if (!code) return;

          const rawQtd = row.getCell(colIndexQtd).value;
          const rawDesc = colIndexDesc !== -1 ? row.getCell(colIndexDesc).value : 0;
          const rawBonif = colIndexBonif !== -1 ? row.getCell(colIndexBonif).value : 0;

          const qtd = Number(rawQtd);
          const desc = Number(rawDesc);
          const bonif = Number(rawBonif);

          if (!buCodesSet.has(code)) {
            inconsistencies.push(`Linha ${rowNum}: Código '${code}' não pertence à unidade de negócio ${currentBU}.`);
            return;
          }

          if (isNaN(qtd) || qtd < 0) {
            inconsistencies.push(`Linha ${rowNum}: Quantidade inválida para código ${code}.`);
            return;
          }

          newCartItems[code] = {
            quantidade: qtd,
            desconto: !isNaN(desc) && desc >= 0 ? desc : 0,
            bonificados: !isNaN(bonif) && bonif >= 0 ? bonif : 0,
          };
        });

        // Atualizar o carrinho com os novos itens
        setCart((prev) => ({
          ...prev,
          [currentBU]: {
            ...prev[currentBU],
            ...newCartItems,
          },
        }));

        if (inconsistencies.length > 0) {
          setInconsistencyDialog({
            open: true,
            title: "Inconsistências encontradas no Pedido",
            list: inconsistencies,
          });
          showMsg("Importação parcial concluída. Algumas linhas continham erros.", "warning");
        } else {
          showMsg("Pedido importado com sucesso!");
        }
      } catch (err) {
        showMsg("Erro ao ler planilha de pedidos.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // resetar input
  };

  // Administrador: Manipulação de preço inline
  const handleTempPriceChange = (code: string, val: string) => {
    const num = parseFloat(val.replace(",", "."));
    setTempPrices((prev) => ({
      ...prev,
      [code]: isNaN(num) ? 0 : num,
    }));
  };

  // Administrador: Salvar tabela de preços para o backend
  const handleSavePrices = async () => {
    try {
      const res = await fetch("/api/precos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tempPrices),
      });
      const data = await res.json();
      if (data.success) {
        setPrices(tempPrices);
        showMsg("Tabela de preços salva e disponibilizada com sucesso!");
      } else {
        showMsg("Erro ao salvar preços no servidor.", "error");
      }
    } catch (err) {
      showMsg("Erro de conexão ao salvar preços.", "error");
    }
  };

  // Administrador: Exportar Preços
  const handleExportPrices = async () => {
    const rows = allProducts.map((p) => {
      const currentPrice = prices[p.codigo] || 0;
      return {
        codigo: p.codigo,
        produto: p.material,
        categoria: p.categoria,
        preco_tabela: currentPrice,
        quantidade: "",
        desconto: "",
        bonificados: "",
      };
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tabela de Preços");

    worksheet.columns = [
      { header: "codigo", key: "codigo", width: 15 },
      { header: "produto", key: "produto", width: 40 },
      { header: "categoria", key: "categoria", width: 20 },
      { header: "preco_tabela", key: "preco_tabela", width: 15 },
      { header: "quantidade", key: "quantidade", width: 12 },
      { header: "desconto", key: "desconto", width: 12 },
      { header: "bonificados", key: "bonificados", width: 12 },
    ];

    rows.forEach((r) => worksheet.addRow(r));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F76E5" },
    };
    worksheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tabela_Precos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg("Tabela de preços exportada com sucesso!");
  };

  // Administrador: Importar Preços via Excel
  const handleImportPrices = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const inconsistencies: string[] = [];
        const allCodesSet = new Set(allProducts.map((p) => p.codigo));

        let colIndexCodigo = -1;
        let colIndexPreco = -1;

        const firstRow = worksheet.getRow(1);
        firstRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().toLowerCase().trim();
          if (val === "codigo") colIndexCodigo = colNum;
          if (val === "preco_tabela") colIndexPreco = colNum;
        });

        if (colIndexCodigo === -1 || colIndexPreco === -1) {
          showMsg("Layout inválido. Colunas 'codigo' e 'preco_tabela' são obrigatórias.", "error");
          return;
        }

        const newPrices: Record<string, number> = { ...tempPrices };

        worksheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return;

          const codeVal = row.getCell(colIndexCodigo).value;
          const code = codeVal ? codeVal.toString().trim() : "";
          if (!code) return;

          const rawPreco = row.getCell(colIndexPreco).value;
          let preco = Number(rawPreco);

          // Lidar com formatação em string de vírgula
          if (typeof rawPreco === "string") {
            preco = Number(rawPreco.replace(",", "."));
          }

          if (!allCodesSet.has(code)) {
            inconsistencies.push(`Linha ${rowNum}: Código '${code}' inexistente no portfólio da FGM.`);
            return;
          }

          if (isNaN(preco) || preco < 0) {
            inconsistencies.push(`Linha ${rowNum}: Preço inválido para código ${code}.`);
            return;
          }

          newPrices[code] = preco;
        });

        setTempPrices(newPrices);

        if (inconsistencies.length > 0) {
          setInconsistencyDialog({
            open: true,
            title: "Inconsistências encontradas nos Preços",
            list: inconsistencies,
          });
          showMsg("Importação concluída com inconsistências.", "warning");
        } else {
          showMsg("Preços importados com sucesso! Não esqueça de salvar as alterações.");
        }
      } catch (err) {
        showMsg("Erro ao importar planilha de preços.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Resumos do Carrinho da Aba ativa
  const cartSummary = useMemo(() => {
    const bu = buKeys[vendedorTab];
    const buCart = cart[bu] || {};

    let totalItems = 0;
    let totalValue = 0;
    let totalBonificados = 0;

    Object.entries(buCart).forEach(([code, data]) => {
      const isSobConsulta = bu === "Home_Care" || bu === "Whiteness";
      const price = isSobConsulta ? 0 : (prices[code] || 0);
      const subtotal = data.quantidade * price * (1 - data.desconto / 100);

      totalItems += data.quantidade;
      totalValue += subtotal;
      totalBonificados += data.bonificados;
    });

    return { totalItems, totalValue, totalBonificados };
  }, [vendedorTab, cart, prices]);

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          background: "radial-gradient(circle at 50% 50%, #0c1524 0%, #030712 100%)",
        }}
      >
        <Head>
          <title>Login - FGM Planilha de Preços</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Container maxWidth="xs">
          <Paper
            elevation={4}
            sx={{
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 3,
              bgcolor: "rgba(11, 15, 25, 0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <Box
              component="img"
              src="/logo-fgm.png"
              alt="FGM Logo"
              sx={{
                height: 48,
                mb: 3,
                objectFit: "contain",
              }}
            />
            <Typography variant="h5" align="center" sx={{ fontWeight: 700, mb: 1, letterSpacing: "-0.5px" }}>
              Planilha de <Typography component="span" variant="h5" sx={{ color: "primary.main", fontWeight: 700 }}>Preços Web</Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Faça login para acessar a plataforma comercial
            </Typography>

            {loginError && (
              <Alert severity="error" sx={{ width: "100%", mb: 2, borderRadius: 2 }}>
                {loginError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin} sx={{ width: "100%" }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Endereço de E-mail"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Senha"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  py: 1.5,
                  fontWeight: 700,
                  background: "linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)",
                  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #818cf8 0%, #6366f1 100%)",
                  },
                }}
              >
                Entrar
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <Head>
        <title>FGM Comercial - Portal de Pedidos & Preços</title>
        <meta name="description" content="Plataforma de apoio a força de vendas FGM. Gerencie preços e monte pedidos Salesforce." />
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noodp, noydir" />
      </Head>

      {/* Header Premium */}
      <Box
        sx={{
          py: 2,
          px: 4,
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          background: "linear-gradient(90deg, #090d16 0%, #0c1221 100%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Logo / Branding */}
          <Box
            component="img"
            src="/logo-fgm.png"
            alt="FGM Logo"
            sx={{
              height: 36,
              objectFit: "contain",
            }}
          />
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.5px" }}>
            Planilha de <Typography component="span" variant="h5" sx={{ color: "primary.main", fontWeight: 700 }}>Preços Web</Typography>
          </Typography>
        </Box>

        {/* Seleção de Perfil & Logout */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleLogout}
            sx={{
              borderColor: "rgba(239, 68, 68, 0.4)",
              color: "#f87171",
              textTransform: "none",
              "&:hover": {
                borderColor: "rgb(239, 68, 68)",
                bgcolor: "rgba(239, 68, 68, 0.05)",
                transform: "none",
                boxShadow: "none"
              }
            }}
          >
            Sair
          </Button>
        </Box>
      </Box>

      {/* Main Container */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6, flexGrow: 1, display: "flex", flexDirection: "column" }} className="fade-in">
        {/* Barra de Filtros e Ações */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <Box sx={{ flexGrow: 1, minWidth: 280, maxWidth: { md: 500 } }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por código, produto ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
            >
              Atualizar
            </Button>
          </Box>
        </Box>

        {role === "vendedor" ? (
          // FLUXO DO VENDEDOR
          <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 3 }}>
            <Paper sx={{ bgcolor: "background.paper", p: 0.5 }}>
              <Tabs
                value={vendedorTab}
                onChange={(_, val) => {
                  setVendedorTab(val);
                  setSearchQuery("");
                }}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab label="Dentscare" />
                <Tab label="Home Care" />
                <Tab label="Whiteness" />
              </Tabs>
            </Paper>

            {/* Tabela de Produtos */}
            <TableContainer component={Paper} sx={{ maxHeight: 550, overflowY: "auto" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="10%">Código</TableCell>
                    <TableCell width="28%">Produto</TableCell>
                    <TableCell width="12%">Promoção</TableCell>
                    <TableCell width="12%">Categoria</TableCell>
                    <TableCell width="10%" align="right">Preço Tabela</TableCell>
                    <TableCell width="8%" align="center">Quantidade</TableCell>
                    <TableCell width="6%" align="center">Desconto (%)</TableCell>
                    <TableCell width="8%" align="right">Preço Total</TableCell>
                    <TableCell width="6%" align="center">Bonificados</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" sx={{ color: "text.secondary" }}>
                          Nenhum produto encontrado.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.filter(p => p.promotionIsActive !== false).map((p) => {
                      const bu = buKeys[vendedorTab];
                      const cItem = cart[bu]?.[p.codigo] || { quantidade: 0, desconto: 0, bonificados: 0 };
                      const isSobConsulta = bu === "Home_Care" || bu === "Whiteness";
                      const price = isSobConsulta ? 0 : (prices[p.codigo] || 0);
                      const displayColor = p.cor && colorMap[p.cor] ? colorMap[p.cor] : "#f3f4f6";
                      const isInactive = p.promotionIsActive === false;
                      const totalPrice = isSobConsulta ? 0 : (price * cItem.quantidade) * (1 - cItem.desconto / 100);

                      return (
                        <TableRow key={p.codigo} hover sx={{ opacity: isInactive ? 0.4 : 1, transition: "opacity 0.2s" }}>
                          <TableCell sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {p.codigo}
                          </TableCell>
                          <TableCell sx={{ color: displayColor, fontWeight: 600 }}>
                            {p.material}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{p.promotionName || "-"}</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{p.categoria}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {isSobConsulta ? "Sob consulta" : (price > 0 ? `R$ ${formatCurrency(price)}` : "Sob consulta")}
                          </TableCell>

                          {/* Quantidade */}
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              variant="outlined"
                              disabled={isInactive}
                              slotProps={{ htmlInput: { min: 0, style: { textAlign: "center", padding: "6px" } } }}
                              value={cItem.quantidade || ""}
                              onChange={(e) =>
                                handleCartChange(bu, p.codigo, "quantidade", parseInt(e.target.value) || 0)
                              }
                              sx={{ width: 80 }}
                            />
                          </TableCell>

                          {/* Desconto */}
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              variant="outlined"
                              disabled={isInactive}
                              slotProps={{ htmlInput: { min: 0, max: 100, style: { textAlign: "center", padding: "6px" } } }}
                              value={cItem.desconto || ""}
                              onChange={(e) =>
                                handleCartChange(bu, p.codigo, "desconto", parseFloat(e.target.value) || 0)
                              }
                              sx={{ width: 65 }}
                            />
                          </TableCell>

                          {/* Preço Total */}
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {isSobConsulta ? "Sob consulta" : `R$ ${formatCurrency(totalPrice)}`}
                          </TableCell>

                          {/* Bonificados */}
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              variant="outlined"
                              disabled={isInactive}
                              slotProps={{ htmlInput: { min: 0, style: { textAlign: "center", padding: "6px" } } }}
                              value={cItem.bonificados || ""}
                              onChange={(e) =>
                                handleCartChange(bu, p.codigo, "bonificados", parseInt(e.target.value) || 0)
                              }
                              sx={{ width: 65 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 1 }}>
              <Box sx={{ flex: { xs: "1 1 100%", md: "7 1 0%" }, minWidth: 300 }}>
                <Card sx={{ bgcolor: "background.paper", display: "flex", flexDirection: "column", height: "100%" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                      <ShoppingCartIcon color="primary" /> Ações do Pedido ({buKeys[vendedorTab]})
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      <Box sx={{ flex: { xs: "1 1 100%", sm: "1 1 0%" } }}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="primary"
                          startIcon={<ContentCopyIcon />}
                          onClick={handleCopyOrder}
                          sx={{ py: 1 }}
                        >
                          Copiar Pedido
                        </Button>
                      </Box>
                      <Box sx={{ flex: { xs: "1 1 100%", sm: "1 1 0%" } }}>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          style={{ display: "none" }}
                          ref={fileInputRefOrder}
                          onChange={handleImportOrder}
                        />
                        <Button
                          fullWidth
                          variant="outlined"
                          color="secondary"
                          startIcon={<FileUploadIcon />}
                          onClick={() => fileInputRefOrder.current?.click()}
                          sx={{ py: 1 }}
                        >
                          Importar Pedido
                        </Button>
                      </Box>
                      <Box sx={{ flex: { xs: "1 1 100%", sm: "1 1 0%" } }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="secondary"
                          startIcon={<FileDownloadIcon />}
                          onClick={handleExportOrder}
                          sx={{ py: 1 }}
                        >
                          Exportar Pedido
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                  <Divider />
                  <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="text" color="error" size="small" onClick={clearCurrentOrder}>
                      Limpar Pedido Desta Aba
                    </Button>
                  </Box>
                </Card>
              </Box>

              {/* Card de Resumo Financeiro */}
              <Box sx={{ flex: { xs: "1 1 100%", md: "5 1 0%" }, minWidth: 300 }}>
                <Card
                  sx={{
                    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(20, 184, 166, 0.08) 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: "text.primary" }}>
                      Resumo da Aba {buKeys[vendedorTab]}
                    </Typography>

                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">Quantidade de Itens:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{cartSummary.totalItems} un</Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">Bonificações:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: "secondary.light" }}>{cartSummary.totalBonificados} un</Typography>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Total Final:</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.light" }}>
                        R$ {formatCurrency(cartSummary.totalValue)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        ) : (
          // FLUXO DO ADMINISTRADOR
          <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 3 }}>
            <Paper sx={{ p: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Gestão Central de Preços
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Atualize os preços de tabela e disponibilize para toda a força de vendas.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 1.5 }}>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleImportPrices}
                />
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<FileUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Importar Preços Excel
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportPrices}
                >
                  Exportar Preços Excel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSavePrices}
                >
                  Salvar Tabela de Preços
                </Button>
              </Box>
            </Paper>

            {/* Tabela de Preços de Portfólio */}
            <TableContainer component={Paper} sx={{ maxHeight: 600, overflowY: "auto" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="15%">Código</TableCell>
                    <TableCell width="45%">Produto</TableCell>
                    <TableCell width="15%">Categoria</TableCell>
                    <TableCell width="12%">Linha/BU</TableCell>
                    <TableCell width="13%" align="right">Preço de Tabela (R$)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" sx={{ color: "text.secondary" }}>
                          Nenhum produto cadastrado.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((p) => {
                      const tempPrice = tempPrices[p.codigo] !== undefined ? tempPrices[p.codigo] : (prices[p.codigo] || 0);
                      const displayColor = p.cor && colorMap[p.cor] ? colorMap[p.cor] : "#f3f4f6";

                      return (
                        <TableRow key={p.codigo} hover>
                          <TableCell sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {p.codigo}
                          </TableCell>
                          <TableCell sx={{ color: displayColor, fontWeight: 600 }}>
                            {p.material}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{p.categoria}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{p.businessUnit?.replace("_", " ")}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="text"
                              size="small"
                              variant="outlined"
                              slotProps={{ htmlInput: { style: { textAlign: "right", padding: "6px" } } }}
                              value={tempPrice.toString().replace(".", ",")}
                              onChange={(e) => handleTempPriceChange(p.codigo, e.target.value)}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Container>

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%", borderRadius: "8px" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialogo de Inconsistências */}
      <Dialog
        open={inconsistencyDialog.open}
        onClose={() => setInconsistencyDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "warning.main", fontWeight: 600 }}>
          <WarningIcon /> {inconsistencyDialog.title}
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Os itens abaixo continham erros ou códigos não encontrados no portfólio da aba e foram ignorados. Os demais dados válidos foram carregados com sucesso.
          </Alert>
          <List dense>
            {inconsistencyDialog.list.map((item, idx) => (
              <ListItem key={idx} sx={{ borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}>
                <ListItemText
                  primary={
                    <Typography sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {item}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInconsistencyDialog((prev) => ({ ...prev, open: false }))} color="primary" variant="contained">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
