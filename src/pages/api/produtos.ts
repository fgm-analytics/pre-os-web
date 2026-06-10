import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCProducts } from "../../lib/sfmc";

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
    // Tentar buscar do Salesforce Marketing Cloud
    const sfmcItems = await fetchSFMCProducts();

    if (sfmcItems && sfmcItems.length > 0) {
      const dentscare: any[] = [];
      const homeCare: any[] = [];
      const whiteness: any[] = [];

      sfmcItems.forEach((item) => {
        const codigo = item.keys.ProductCode;
        const material = item.values.Description || "";
        const promotionName = item.values.promotionname || "";
        const promotionIsActive = item.values.promotionisactive !== "false"; // default true unless explicitly "false"

        const { categoria, businessUnit, cor } = classifyProduct(material);

        const prod = {
          codigo,
          material,
          categoria,
          cor,
          businessUnit,
          promotionName,
          promotionIsActive,
        };

        if (businessUnit === "Home_Care") {
          homeCare.push(prod);
        } else if (businessUnit === "Whiteness") {
          whiteness.push(prod);
        } else {
          dentscare.push(prod);
        }
      });

      return res.status(200).json({
        Dentscare: dentscare,
        Home_Care: homeCare,
        Whiteness: whiteness,
      });
    }

    // Fallback local caso SFMC não esteja configurado ou falhe
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

    // Adicionar mock de promoções no fallback local para fins de testes
    const addMockPromotions = (p: any) => {
      if (p.codigo.endsWith("1") || p.codigo.endsWith("3")) {
        p.promotionName = "Promoção FGM Ativa";
        p.promotionIsActive = true;
      } else if (p.codigo.endsWith("2") || p.codigo.endsWith("4")) {
        p.promotionName = "Promoção FGM Inativa";
        p.promotionIsActive = false;
      }
      return p;
    };

    return res.status(200).json({
      Dentscare: dentscareRaw.map(addMockPromotions),
      Home_Care: homeCareRaw.map(addMockPromotions),
      Whiteness: whitenessRaw.map(addMockPromotions),
    });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Erro ao ler lista de produtos." });
  }
}
