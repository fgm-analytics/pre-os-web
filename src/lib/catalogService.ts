import fs from "fs";
import path from "path";
import { getCachedData } from "./redis";
import { fetchSFMCPriceEntries, fetchSFMCProducts } from "./sfmc";

export async function getTabelaPrecosV2() {
  return await getCachedData("tabela_precos_v2", async () => {
    const filePath = path.join(process.cwd(), "data", "tabela_precos.json");
    let localPrices: Record<string, number> = {};
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      localPrices = JSON.parse(fileContent);
    }

    try {
      const sfmcEntries = await fetchSFMCPriceEntries();
      if (sfmcEntries && sfmcEntries.length > 0) {
        const prices: Record<string, number> = { ...localPrices };
        sfmcEntries.forEach((entry: any) => {
          if (entry.ProductCode && entry.UnitPrice > 0) {
            prices[entry.ProductCode] = entry.UnitPrice;
          }
        });
        return prices;
      }
    } catch (e) {
      console.error("Erro ao buscar preços SFMC no service", e);
    }
    
    return localPrices;
  }, 1800);
}

export async function getListaProdutosV5() {
  return await getCachedData("lista_produtos_v5", async () => {
    const dataDir = path.join(process.cwd(), "data");

    const dentscarePath = path.join(dataDir, "Dentscare.json");
    const homeCarePath = path.join(dataDir, "Home_Care.json");
    const whitenessPath = path.join(dataDir, "Whiteness.json");

    const dentscareRaw = fs.existsSync(dentscarePath) ? JSON.parse(fs.readFileSync(dentscarePath, "utf-8")) : [];
    const homeCareRaw = fs.existsSync(homeCarePath) ? JSON.parse(fs.readFileSync(homeCarePath, "utf-8")) : [];
    const whitenessRaw = fs.existsSync(whitenessPath) ? JSON.parse(fs.readFileSync(whitenessPath, "utf-8")) : [];

    let sfmcItems: any[] = [];
    try {
      sfmcItems = (await fetchSFMCProducts()) || [];
    } catch (e) {
      console.error("Erro ao buscar produtos SFMC no service", e);
    }

    const sfmcMap = new Map<string, { name: string; isActive: boolean; used: boolean; promotionName: string }>();
    if (sfmcItems && sfmcItems.length > 0) {
      sfmcItems.forEach((item: any) => {
        const keys = (item.keys || {}) as any;
        const values = (item.values || {}) as any;
        const codigo = String(keys.ProductCode || values.ProductCode || keys.productcode || values.productcode || "").trim();
        const material = values.Description || values.description || "";
        const promotionName = values.promotionname || values.promotionName || "";
        const promotionIsActive = values.promotionisactive !== "false" && values.promotionIsActive !== "false" && values.promotionisactive !== false && values.promotionIsActive !== false;

        if (codigo) {
          sfmcMap.set(codigo, {
            name: material,
            isActive: promotionIsActive,
            used: false,
            promotionName: promotionName,
          });
        }
      });
    }

    const processList = (rawList: any[], targetBU: string) => {
      return rawList.map((item: any) => {
        const code = String(item.codigo).trim();
        const sfmcData = sfmcMap.get(code);
        if (sfmcData) sfmcData.used = true;

        return {
          codigo: item.codigo,
          material: sfmcData ? (sfmcData.name || item.material) : item.material,
          categoria: item.categoria || "Geral",
          cor: item.cor || "dark_gray",
          businessUnit: targetBU,
          promotionName: sfmcData ? sfmcData.promotionName : "",
          promotionIsActive: sfmcData ? sfmcData.isActive : true,
          segmentacao: item.segmentacao !== undefined ? item.segmentacao : 40,
          ipi: item.ipi !== undefined ? item.ipi : 0,
        };
      });
    };

    const result: Record<string, any[]> = {
      Dentscare: processList(dentscareRaw, "Dentscare"),
      Home_Care: processList(homeCareRaw, "Home_Care"),
      Whiteness: processList(whitenessRaw, "Whiteness"),
      Inbox: [],
    };

    sfmcMap.forEach((data, code) => {
      if (!data.used && data.isActive) {
        result.Inbox.push({
          codigo: code,
          material: data.name,
          categoria: "SFMC Importado",
          cor: "dark_gray",
          businessUnit: "Inbox",
          promotionName: "",
          promotionIsActive: true,
          segmentacao: 40,
          ipi: 0,
        });
      }
    });

    return result;
  }, 1800);
}
