import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { fetchSFMCPriceEntries } from "../../lib/sfmc";
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
    const data = await getCachedData("lista_produtos_v5", async () => {
      // Carregar arquivos JSON locais — fonte oficial da estrutura e sequência de produtos
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

      console.log(`[API produtos] JSONs carregados: Dentscare=${dentscareRaw.length}, Home_Care=${homeCareRaw.length}, Whiteness=${whitenessRaw.length}`);

      // Tentar buscar dados de promoção/preço do SFMC para enriquecer
      const sfmcEntries = await fetchSFMCPriceEntries();

      const sfmcMap = new Map<string, { name: string; isActive: boolean; used: boolean }>();
      if (sfmcEntries && sfmcEntries.length > 0) {
        sfmcEntries.forEach((entry) => {
          if (entry.ProductCode) {
            sfmcMap.set(entry.ProductCode, {
              name: entry.ProductName || "",
              isActive: entry.IsActive,
              used: false,
            });
          }
        });
        console.log(`[API produtos] SFMC enriquecimento: ${sfmcMap.size} entradas`);
      } else {
        console.log("[API produtos] SFMC indisponível, usando dados locais puros");
      }

      // Processar lista de produtos de cada BU
      const processList = (rawList: any[], targetBU: string) => {
        return rawList.map((item: any) => {
          const code = String(item.codigo).trim();
          const sfmcData = sfmcMap.get(code);
          if (sfmcData) sfmcData.used = true;

          return {
            codigo: item.codigo,
            material: item.material,
            categoria: item.categoria || "Geral",
            cor: item.cor || "dark_gray",
            businessUnit: targetBU,
            promotionName: "",
            promotionIsActive: sfmcData ? sfmcData.isActive : true, // Se SFMC disponível, usa status; senão mostra todos
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

      // Adicionar produtos do SFMC não mapeados ao Inbox (para o painel admin)
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
    }, 1800); // 30 min cache

    return res.status(200).json(data);
  } catch (error) {
    console.error("API /api/produtos Error:", error);
    return res.status(500).json({ error: "Erro ao carregar lista de produtos." });
  }
}
