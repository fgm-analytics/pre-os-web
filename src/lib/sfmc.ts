// SFMC Integration — Fonte: PricebookEntry_Salesforce
// Pricebook2Id = 01sV20000016SsKIAU (lista de preços oficial FGM)

interface SFMCTokenResponse {
  access_token: string;
  rest_instance_url: string;
}

// Linha da tabela PricebookEntry_Salesforce no SFMC
export interface SFMCPriceEntry {
  ProductCode: string;       // Código do produto (= material SAP)
  ProductName: string;       // Descrição do produto
  UnitPrice: number;         // Preço de tabela
  IsActive: boolean;         // Produto ativo na org de vendas
  OrganizationSales?: string; // Organização de vendas (ex: 11, 22, 44)
  GrupoPrincipal?: string;   // Grupo Principal = categoria
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let tokenCache: CacheEntry<SFMCTokenResponse> | null = null;
let priceEntryCache: CacheEntry<SFMCPriceEntry[]> | null = null;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export async function getSFMCToken(): Promise<SFMCTokenResponse | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.data;
  }

  const clientId = process.env.SFMC_CLIENT_ID;
  const clientSecret = process.env.SFMC_CLIENT_SECRET;
  const authUrl = process.env.SFMC_AUTH_URI;

  if (!clientId || !clientSecret || !authUrl) {
    return null;
  }

  try {
    const res = await fetch(`${authUrl.replace(/\/$/, "")}/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Auth failed with status ${res.status}`);
    }

    const data = (await res.json()) as SFMCTokenResponse;
    tokenCache = { data, expiresAt: now + CACHE_TTL };
    return data;
  } catch (error) {
    console.error("SFMC Auth Error:", error);
    return null;
  }
}

/**
 * Busca produtos e preços da tabela PricebookEntry_Salesforce no SFMC.
 * Filtra pelo Pricebook2Id oficial da FGM: 01sV20000016SsKIAU
 * Retorna apenas produtos ativos (IsActive = true).
 */
export async function fetchSFMCPriceEntries(): Promise<SFMCPriceEntry[] | null> {
  const now = Date.now();
  if (priceEntryCache && priceEntryCache.expiresAt > now) {
    return priceEntryCache.data;
  }

  const tokenData = await getSFMCToken();
  if (!tokenData) return null;

  const restUrl = process.env.SFMC_REST_URI || tokenData.rest_instance_url;
  const deKey = "PricebookEntry_Salesforce";

  try {
    const res = await fetch(
      `${restUrl.replace(/\/$/, "")}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=2500`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Data fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    const items: any[] = data.items || [];

    const PRICEBOOK_ID = "01sV20000016SsKIAU";

    const entries: SFMCPriceEntry[] = items
      .filter((item: any) => {
        const vals = item.values || {};
        const pricebookId = vals.Pricebook2Id || vals.pricebook2id || "";
        const isActive = vals.IsActive !== "false" && vals.isactive !== "false" && vals.IsActive !== false;
        return pricebookId === PRICEBOOK_ID && isActive;
      })
      .map((item: any) => {
        const keys = item.keys || {};
        const vals = item.values || {};
        const rawPrice = vals.UnitPrice || vals.unitprice || "0";
        return {
          ProductCode: String(keys.ProductCode || vals.ProductCode || vals.productcode || "").trim(),
          ProductName: String(vals.Name || vals.name || vals.ProductName || vals.productname || "").trim(),
          UnitPrice: parseFloat(String(rawPrice).replace(",", ".")) || 0,
          IsActive: true,
          OrganizationSales: String(vals.OrganizationSales__c || vals.organizationsales__c || "").trim(),
          GrupoPrincipal: String(vals.GrupoPrincipal__c || vals.grupoprincipal__c || vals.Family || vals.family || "").trim(),
        };
      })
      .filter((e) => e.ProductCode !== "");

    priceEntryCache = { data: entries, expiresAt: now + CACHE_TTL };
    return entries;
  } catch (error) {
    console.error("SFMC PricebookEntry Fetch Error:", error);
    return null;
  }
}

// Mantém a função antiga com nome genérico para não quebrar referências legadas
export async function fetchSFMCProducts() {
  return fetchSFMCPriceEntries();
}
