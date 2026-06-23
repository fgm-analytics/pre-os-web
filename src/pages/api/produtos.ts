import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCProducts } from "../../lib/sfmc";
import { getCachedData } from "../../lib/redis";

const classifyProduct = (description: string) => {
  const desc = description.toUpperCase();
  
  // Categorias
  let categoria = "Geral";
  if (desc.includes("WHITENESS") || desc.includes("WHITE CLASS") || desc.includes("WHITE CARE") || desc.includes("WITSMILE")) {
    categoria = "Clareadores";
  } else if (desc.includes("FRESHNESS") || desc.includes("ESCOVA") || desc.includes("FIO DENTAL") || desc.includes("FITA DENTAL")) {
    categoria = "Higiene Oral";
  } else if (desc.includes("ALLCEM")) {
    categoria = "Cimento Resinoso";
  } else if (desc.includes("AMBAR")) {
    categoria = "Adesivos";
  } else if (desc.includes("DIAMOND")) {
    categoria = "Acabamento";
  } else if (desc.includes("NANOSYNT") || desc.includes("DUOSYNT")) {
    categoria = "Enxerto/Membrana";
  } else if (desc.includes("CAVIBRUSH")) {
    categoria = "Haste flexível";
  } else if (desc.includes("VOXELPRINT")) {
    categoria = "Impressão 3D";
  } else if (desc.includes("MAXXION")) {
    categoria = "Ionômero de vidro";
  } else if (desc.includes("ORTHO") || desc.includes("BRÁQUETES")) {
    categoria = "Ortodontia";
  } else if (desc.includes("WHITEPOST")) {
    categoria = "Pino de Fibra";
  } else if (desc.includes("PREVENT")) {
    categoria = "Selante";
  } else if (desc.includes("PROSIL")) {
    categoria = "Silano";
  } else if (desc.includes("ELORA") || desc.includes("OPUS") || desc.includes("OPALLIS")) {
    categoria = "Resinas";
  }

  // Business Units (BUs)
  let businessUnit = "Dentscare";
  if (desc.includes("(HC)") || desc.includes("WITSMILE") || desc.includes("WHITE CLASS") || desc.includes("WHITE CARE") || desc.includes("DESENSIBILIZE KF 0,2%")) {
    businessUnit = "Home_Care";
  } else if (desc.includes("(W)") || (desc.includes("WHITENESS") && !desc.includes("(HC)"))) {
    businessUnit = "Whiteness";
  }

  // Cores de destaque
  let cor = "dark_gray";
  if (desc.includes("PERFECT") || desc.includes("AUTOMIXX") || desc.includes("MAXX")) {
    cor = "green";
  } else if (desc.includes("BLUE")) {
    cor = "purple";
  } else if (desc.includes("SIMPLE")) {
    cor = "brown";
  } else if (desc.includes("WHITE CLASS")) {
    cor = "dark_gray";
  } else if (desc.includes("KF 2%")) {
    cor = "cyan";
  } else if (desc.includes("KF 0,2%")) {
    cor = "cyan";
  }

  return { categoria, businessUnit, cor };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Método ${req.method} não permitido.` });
  }

  try {
    const data = await getCachedData("lista_produtos", async () => {
      // Carregar arquivos JSON locais primeiro para definir a estrutura permitida e sequência
      const dataDir = path.join(process.cwd(), "data");
      
      const dentscarePath = path.join(dataDir, "Dentscare.json");
      const homeCarePath = path.join(dataDir, "Home_Care.json");
      const whitenessPath = path.join(dataDir, "Whiteness.json");

      const dentscareRaw = fs.existsSync(dentscarePath) 
        ? JSON.parse(fs.readFileSync(dentscarePath, "utf-8")) 
        : [];

      const homeCareRaw = fs.existsSync(homeCarePath) 
        ? JSON.parse(fs.readFileSync(homeCarePath, "utf-8")) 
        : [];

      const whitenessRaw = fs.existsSync(whitenessPath) 
        ? JSON.parse(fs.readFileSync(whitenessPath, "utf-8")) 
        : [];

      // Tentar buscar do Salesforce Marketing Cloud
      const sfmcItems = await fetchSFMCProducts();

      if (sfmcItems && sfmcItems.length > 0) {
        const sfmcMap = new Map<string, any>();
        
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

        const processList = (rawList: any[], targetBU: string) => {
          return rawList.map((item: any) => {
            const code = String(item.codigo).trim();
            const sfmcData = sfmcMap.get(code);
            if (sfmcData) {
              return {
                codigo: item.codigo,
                material: sfmcData.material || item.material,
                categoria: item.categoria || "Geral",
                cor: item.cor || "dark_gray",
                businessUnit: targetBU,
                promotionName: sfmcData.promotionName,
                promotionIsActive: sfmcData.promotionIsActive,
                segmentacao: item.segmentacao !== undefined ? item.segmentacao : 40,
                ipi: item.ipi !== undefined ? item.ipi : 0,
              };
            } else {
              return {
                codigo: item.codigo,
                material: item.material,
                categoria: item.categoria || "Geral",
                cor: item.cor || "dark_gray",
                businessUnit: targetBU,
                promotionName: "",
                promotionIsActive: false,
                segmentacao: item.segmentacao !== undefined ? item.segmentacao : 40,
                ipi: item.ipi !== undefined ? item.ipi : 0,
              };
            }
          });
        };

        return {
          Dentscare: processList(dentscareRaw, "Dentscare"),
          Home_Care: processList(homeCareRaw, "Home_Care"),
          Whiteness: processList(whitenessRaw, "Whiteness"),
        };
      }

      // Adicionar mock de promoções no fallback local para fins de testes
      const addMockPromotions = (p: any) => {
        if (p.codigo.endsWith("1") || p.codigo.endsWith("3")) {
          p.promotionName = "Promoção FGM Ativa";
          p.promotionIsActive = true;
        } else if (p.codigo.endsWith("2") || p.codigo.endsWith("4")) {
          p.promotionName = "Promoção FGM Inativa";
          p.promotionIsActive = false;
        }
        p.segmentacao = p.segmentacao !== undefined ? p.segmentacao : 40;
        p.ipi = p.ipi !== undefined ? p.ipi : 0;
        return p;
      };

      return {
        Dentscare: dentscareRaw.map(addMockPromotions),
        Home_Care: homeCareRaw.map(addMockPromotions),
        Whiteness: whitenessRaw.map(addMockPromotions),
      };
    }, 86400); // 1 dia

    return res.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Erro ao ler lista de produtos." });
  }
}
