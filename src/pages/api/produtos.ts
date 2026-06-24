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
      // 1. Tentar buscar mapeamento de BU original do banco de dados (f_shelf_life / d_org_venda)
      const { data: dbProducts, error: dbError } = await supabase
        .from('vw_produto_bu')
        .select('produto_codigo, business_unit, categoria');

      const buMap = new Map<string, string>();
      const catMap = new Map<string, string>();
      const activeProducts = new Set<string>();
      if (dbProducts && !dbError) {
        dbProducts.forEach(p => {
          let bu = p.business_unit;
          if (bu === 'Home Care') bu = 'Home_Care';
          const code = String(p.produto_codigo).trim();
          buMap.set(code, bu);
          catMap.set(code, p.categoria || "Geral");
          activeProducts.add(code);
        });
      }

      // 2. Busca do banco de dados a configuração (ordem, cor, categoria, bu override)
      const { data: configProducts, error: configError } = await supabase
        .from('config_produto')
        .select('*');
        
      const configMap = new Map<string, any>();
      if (configProducts && !configError && configProducts.length > 0) {
        configProducts.forEach(p => configMap.set(String(p.produto_codigo).trim(), p));
      } else {
        // Fallback: se config_produto estiver vazio, lê os JSONs (apenas como compatibilidade)
        const dataDir = path.join(process.cwd(), "data");
        for (const buFile of ["Dentscare", "Home_Care", "Whiteness"]) {
          const filePath = path.join(dataDir, `${buFile}.json`);
          if (fs.existsSync(filePath)) {
            const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            raw.forEach((item: any, idx: number) => {
              const code = String(item.codigo).trim();
              configMap.set(code, {
                produto_codigo: code,
                business_unit: buFile,
                categoria: item.categoria || "Geral",
                cor: item.cor || "dark_gray",
                segmentacao: item.segmentacao || 40,
                ipi: item.ipi || 0,
                ordem_exibicao: idx + 1
              });
              // Para fallback, assume que está ativo se estiver no JSON
              activeProducts.add(code);
              if (!buMap.has(code)) buMap.set(code, buFile);
            });
          }
        }
      }

      // 3. Tentar buscar do Salesforce Marketing Cloud
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
            // Se o produto está no SFMC, assumimos que está ativo
            activeProducts.add(codigo);
          }
        });
      }

      // 4. Montar os itens finais combinando tudo
      const processedItems: any[] = [];
      
      activeProducts.forEach(code => {
        const config = configMap.get(code);
        const sfmcData = sfmcMap.get(code);
        // Regra de BU: O override na config_produto ganha. Senão usa a f_shelf_life. Senão "Outros"
        let targetBU = config?.business_unit || buMap.get(code) || "Outros";
        if (targetBU === 'Home Care') targetBU = 'Home_Care';
        
        // Verifica se é um produto novo do ERP não categorizado pelo admin
        const isNew = !config;
        if (isNew) {
           targetBU = "Inbox"; // Vai para a aba de novos produtos no Editor
        }

        const baseItem = {
          codigo: code,
          material: sfmcData?.material || `Produto ${code}`, // o material real idealmente viria de uma d_produto, fallback sfmc
          categoria: catMap.get(code) || "Geral", // Categoria vem da d_material (via vw_produto_bu)
          cor: config?.cor || "dark_gray",
          businessUnit: targetBU,
          promotionName: sfmcData ? sfmcData.promotionName : "",
          promotionIsActive: sfmcData ? sfmcData.promotionIsActive : false,
          segmentacao: config?.segmentacao !== undefined ? config.segmentacao : 40,
          ipi: config?.ipi !== undefined ? config.ipi : 0,
          ordem_exibicao: config?.ordem_exibicao || 9999, // Vai pro final se não tiver ordem
          isNew: isNew
        };
        
        processedItems.push(baseItem);
      });

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

      // Ordenar globalmente por ordem de exibicao
      processedItems.sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);

      // Reagrupar para o formato de resposta esperado (por aba)
      return {
        Dentscare: processedItems.filter(p => p.businessUnit === "Dentscare"),
        Home_Care: processedItems.filter(p => p.businessUnit === "Home_Care"),
        Whiteness: processedItems.filter(p => p.businessUnit === "Whiteness"),
        Inbox: processedItems.filter(p => p.businessUnit === "Inbox")
      };
    }, 86400); // 1 dia

    return res.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Erro ao ler lista de produtos." });
  }
}
