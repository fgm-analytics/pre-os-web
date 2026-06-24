import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCProducts } from "../../lib/sfmc";
import { getCachedData } from "../../lib/redis";
import { supabase } from "../../lib/supabase";



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Acesso não autorizado" });
  }

  try {
    const data = await getCachedData("lista_produtos", async () => {
      // Carregar arquivos JSON locais primeiro para definir a estrutura permitida e sequência
      const dataDir = path.join(process.cwd(), "data");
      
      const dentscarePath = path.join(dataDir, "Dentscare.json");
      const homeCarePath = path.join(dataDir, "Home_Care.json");
      const whitenessPath = path.join(dataDir, "Whiteness.json");

      const dentscareRaw = fs.existsSync(dentscarePath) 
        ? JSON.parse(fs.readFileSync(dentscarePath, "utf-8")).map((i: any) => ({ ...i, originalBU: "Dentscare" }))
        : [];

      const homeCareRaw = fs.existsSync(homeCarePath) 
        ? JSON.parse(fs.readFileSync(homeCarePath, "utf-8")).map((i: any) => ({ ...i, originalBU: "Home_Care" }))
        : [];

      const whitenessRaw = fs.existsSync(whitenessPath) 
        ? JSON.parse(fs.readFileSync(whitenessPath, "utf-8")).map((i: any) => ({ ...i, originalBU: "Whiteness" }))
        : [];

      const allRawItems = [...dentscareRaw, ...homeCareRaw, ...whitenessRaw];

      // Tentar buscar mapeamento de BU do banco de dados ODS (f_shelf_life / d_org_venda)
      const { data: dbProducts, error: dbError } = await supabase
        .from('vw_produto_bu')
        .select('produto_codigo, business_unit');

      const buMap = new Map<string, string>();
      if (dbProducts && !dbError) {
        dbProducts.forEach(p => {
          // Normalize to match frontend expected keys
          let bu = p.business_unit;
          if (bu === 'Home Care') bu = 'Home_Care';
          buMap.set(String(p.produto_codigo).trim(), bu);
        });
      }

      // Tentar buscar do Salesforce Marketing Cloud
      const sfmcItems = await fetchSFMCProducts();
      const sfmcMap = new Map<string, any>();

      if (sfmcItems && sfmcItems.length > 0) {
        sfmcItems.forEach((item) => {
          const keys = (item.keys || {}) as any;
          const values = (item.values || {}) as any;
          const codigo = String(keys.ProductCode || values.ProductCode || keys.productcode || values.productcode || "").trim();
          const material = values.Description || values.description || "";
          const promotionName = values.promotionname || values.promotionName || "";
          const promotionIsActive = values.promotionisactive !== "false" && values.promotionIsActive !== "false" && values.promotionisactive !== false && values.promotionIsActive !== false;

          if (codigo) {
            sfmcMap.set(codigo, { material, promotionName, promotionIsActive });
          }
        });
      }

      const processItem = (item: any) => {
        const code = String(item.codigo).trim();
        const sfmcData = sfmcMap.get(code);
        const targetBU = buMap.get(code) || item.originalBU || "Outros"; // Usa banco, fallback pro JSON
        
        const baseItem = {
          codigo: code,
          material: sfmcData ? (sfmcData.material || item.material) : (item.material || "Produto sem descrição"),
          categoria: item.categoria || "Geral",
          cor: item.cor || "dark_gray",
          businessUnit: targetBU,
          promotionName: sfmcData ? sfmcData.promotionName : "",
          promotionIsActive: sfmcData ? sfmcData.promotionIsActive : false,
          segmentacao: item.segmentacao !== undefined ? item.segmentacao : 40,
          ipi: item.ipi !== undefined ? item.ipi : 0,
        };
        
        return baseItem;
      };

      // Garantir que produtos que estão no SFMC ou Banco, mas não nos JSONs locais, sejam incluídos
      const existingCodes = new Set(allRawItems.map(i => String(i.codigo).trim()));
      
      sfmcMap.forEach((data, code) => {
        if (!existingCodes.has(code)) {
          allRawItems.push({
            codigo: code,
            material: data.material,
            // Categoria, cor, etc. vão cair no default
          });
          existingCodes.add(code);
        }
      });

      buMap.forEach((bu, code) => {
        if (!existingCodes.has(code)) {
          allRawItems.push({
            codigo: code,
            material: "Produto " + code,
            originalBU: bu
          });
          existingCodes.add(code);
        }
      });

      const processedItems = allRawItems.map(processItem);

      // Adicionar mock de promoções no fallback local para fins de testes (caso sem SFMC)
      if (!sfmcItems || sfmcItems.length === 0) {
        processedItems.forEach(p => {
          if (p.codigo.endsWith("1") || p.codigo.endsWith("3")) {
            p.promotionName = "Promoção FGM Ativa";
            p.promotionIsActive = true;
          } else if (p.codigo.endsWith("2") || p.codigo.endsWith("4")) {
            p.promotionName = "Promoção FGM Inativa";
            p.promotionIsActive = false;
          }
        });
      }

      // Reagrupar para o formato de resposta esperado (por aba)
      return {
        Dentscare: processedItems.filter(p => p.businessUnit === "Dentscare"),
        Home_Care: processedItems.filter(p => p.businessUnit === "Home_Care"),
        Whiteness: processedItems.filter(p => p.businessUnit === "Whiteness"),
      };
    }, 86400); // 1 dia

    return res.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Erro ao ler lista de produtos." });
  }
}
