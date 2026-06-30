import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  IconButton,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SaveIcon from "@mui/icons-material/Save";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  codigo: string;
  material: string;
  categoria?: string;
  cor?: string;
  businessUnit: string;
  segmentacao?: number;
  ipi?: number;
  ordem_exibicao?: number;
};

const colorOptions = [
  "dark_gray", "white", "light_gray", "orange", "green", 
  "blue", "brown", "purple", "cyan", "yellow", 
  "pink", "light_blue", "black", "red"
];

const buOptions = ["Dentscare", "Home_Care", "Whiteness", "Inbox"];

export default function AdminCatalogo() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentTab, setCurrentTab] = useState("Dentscare");
  const [products, setProducts] = useState<ProductRow[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase.from('usuarios').select('role').eq('id', session.user.id).single();
      if (!profile || profile.role !== 'admin') {
        router.push("/performance");
        return;
      }

      const res = await fetch("/api/produtos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      
      const data = await res.json();
      
      // Flatten arrays and ensure ordem_exibicao
      let flatProducts: ProductRow[] = [];
      ["Dentscare", "Home_Care", "Whiteness", "Inbox"].forEach((bu) => {
        if (data[bu]) {
          flatProducts = [...flatProducts, ...data[bu].map((p: ProductRow, idx: number) => ({
            ...p,
            businessUnit: bu,
            ordem_exibicao: p.ordem_exibicao || idx + 1
          }))];
        }
      });
      
      // Sort globally
      flatProducts.sort((a, b) => (a.ordem_exibicao ?? 0) - (b.ordem_exibicao ?? 0));
      setProducts(flatProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProducts();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Update ordem_exibicao based on current index per BU
      const finalProducts = [...products];
      const buCounters: Record<string, number> = { Dentscare: 1, Home_Care: 1, Whiteness: 1, Inbox: 1 };
      
      finalProducts.forEach((p) => {
        p.ordem_exibicao = buCounters[p.businessUnit]++;
      });

      const res = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ products: finalProducts }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao salvar");
      }

      setSuccess("Configurações salvas com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const moveProduct = (codigo: string, direction: "up" | "down") => {
    const buProducts = products.filter(p => p.businessUnit === currentTab);
    const idx = buProducts.findIndex(p => p.codigo === codigo);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === buProducts.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const itemToMove = buProducts[idx];
    const itemToSwap = buProducts[targetIdx];

    const newProducts = [...products];
    const globalIdx1 = newProducts.findIndex(p => p.codigo === itemToMove.codigo);
    const globalIdx2 = newProducts.findIndex(p => p.codigo === itemToSwap.codigo);
    
    // Swap globally
    newProducts[globalIdx1] = itemToSwap;
    newProducts[globalIdx2] = itemToMove;

    setProducts(newProducts);
  };

  const updateProduct = (codigo: string, field: keyof ProductRow, value: string | number) => {
    setProducts(products.map(p => p.codigo === codigo ? { ...p, [field]: value } : p));
  };

  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  const currentProducts = products.filter(p => p.businessUnit === currentTab);

  return (
    <Box sx={{ p: 4, backgroundColor: "#111", minHeight: "100vh", color: "#fff" }}>
      <Head><title>Editor de Catálogo - Admin</title></Head>
      
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>Gestão de Catálogo (Admin)</Typography>
        <Button 
          variant="contained" 
          color="success" 
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ backgroundColor: "#222", p: 2 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, val) => setCurrentTab(val)} 
          textColor="inherit"
          indicatorColor="primary"
          sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        >
          <Tab value="Dentscare" label="Dentscare" />
          <Tab value="Home_Care" label="Home Care" />
          <Tab value="Whiteness" label="Whiteness" />
          <Tab value="Inbox" label={`Novos / Inbox (${products.filter(p => p.businessUnit === "Inbox").length})`} sx={{ color: "#ff9800" }} />
        </Tabs>

        {currentProducts.length === 0 ? (
          <Typography sx={{ p: 2, color: "gray" }}>Nenhum produto nesta aba.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {currentProducts.map((p, index) => (
              <Paper key={p.codigo} sx={{ display: "flex", alignItems: "center", p: 1, backgroundColor: "#333", color: "#fff" }}>
                
                {/* SETAS */}
                <Box sx={{ display: "flex", flexDirection: "column", mr: 2 }}>
                  <IconButton 
                    size="small" 
                    onClick={() => moveProduct(p.codigo, "up")} 
                    disabled={index === 0}
                    sx={{ color: index === 0 ? "#555" : "#fff" }}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => moveProduct(p.codigo, "down")} 
                    disabled={index === currentProducts.length - 1}
                    sx={{ color: index === currentProducts.length - 1 ? "#555" : "#fff" }}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: "bold" }}>{p.material}</Typography>
                  <Typography variant="body2" color="gray">Código: {p.codigo} | Cat: {p.categoria} (do ERP)</Typography>
                </Box>

                {/* COR */}
                <Select
                  size="small"
                  value={p.cor}
                  onChange={(e) => updateProduct(p.codigo, "cor", e.target.value)}
                  sx={{ width: 150, mr: 2, color: "#fff", ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
                >
                  {colorOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>

                {/* ABA (BU) */}
                <Select
                  size="small"
                  value={p.businessUnit}
                  onChange={(e) => updateProduct(p.codigo, "businessUnit", e.target.value)}
                  sx={{ width: 150, color: "#fff", ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" } }}
                >
                  {buOptions.map(bu => <MenuItem key={bu} value={bu}>{bu.replace("_", " ")}</MenuItem>)}
                </Select>

              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
