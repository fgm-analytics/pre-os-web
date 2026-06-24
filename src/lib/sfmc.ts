// SFMC Integration — Fonte: PricebookEntry_Salesforce
// Pricebook2Id = 01sV20000016SsKIAU (lista de preços oficial FGM)
// Campos esperados no Data Extension:
//   keys.ProductCode  → código do produto (= Material no SAP/ERP)
//   values.Name       → nome do produto
//   values.UnitPrice  → preço de tabela
//   values.Pricebook2Id → ID da tabela de preços (para filtrar)
//   values.IsActive   → status do produto na tabela

interface SFMCTokenResponse {
  access_token: string;
  rest_instance_url: string;
}

export interface SFMCPriceEntry {
  ProductCode: string;
  ProductName: string;
  UnitPrice: number;
  IsActive: boolean;
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

    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

    const data = (await res.json()) as SFMCTokenResponse;
    tokenCache = { data, expiresAt: now + CACHE_TTL };
    return data;
  } catch (error) {
    console.error("SFMC Auth Error:", error);
    return null;
  }
}

/**
 * Busca produtos e preços da Data Extension PricebookEntry_Salesforce no SFMC.
 * Filtra pelo Pricebook2Id = 01sV20000016SsKIAU (tabela de preços oficial FGM).
 * 
 * Campos mapeados:
 *   - keys.ProductCode → código do produto
 *   - values.Name      → nome do produto
 *   - values.UnitPrice → preço de tabela
 *   - values.Pricebook2Id → ID da price list (filtro)
 *   - values.IsActive  → status ativo
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
  const PRICEBOOK_ID = "01sV20000016SsKIAU";

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

    if (!res.ok) throw new Error(`Data fetch failed: ${res.status}`);

    const data = await res.json();
    const items: any[] = data.items || [];

    // Log first item to debug field names in production
    if (items.length > 0) {
      console.log("[SFMC] First PricebookEntry item keys:", JSON.stringify(items[0].keys));
      console.log("[SFMC] First PricebookEntry item values:", JSON.stringify(items[0].values));
    }

    // Helper: pega valor de um campo tentando várias capitalizações
    const getField = (obj: any, ...fields: string[]): string => {
      for (const f of fields) {
        if (obj[f] !== undefined && obj[f] !== null && obj[f] !== "") {
          return String(obj[f]);
        }
        // Case-insensitive fallback
        const lower = f.toLowerCase();
        const match = Object.keys(obj).find(k => k.toLowerCase() === lower);
        if (match && obj[match] !== undefined && obj[match] !== null && obj[match] !== "") {
          return String(obj[match]);
        }
      }
      return "";
    };

    // Filtrar pelo Pricebook2Id correto — se nenhum passar, usar todos
    // (a DE pode já estar pré-filtrada para esse pricebook)
    const filteredByPricebook = items.filter((item: any) => {
      const vals = item.values || {};
      const pricebookId = getField(vals, "Pricebook2Id", "pricebook2id");
      return pricebookId === PRICEBOOK_ID;
    });

    const workingItems = filteredByPricebook.length > 0 ? filteredByPricebook : items;
    console.log(`[SFMC] Total items: ${items.length}, after Pricebook filter: ${filteredByPricebook.length}, working with: ${workingItems.length}`);

    const entries: SFMCPriceEntry[] = workingItems
      .map((item: any) => {
        const keys = item.keys || {};
        const vals = item.values || {};

        // ProductCode: em keys ou values
        const code = getField(keys, "ProductCode") || getField(vals, "ProductCode");

        // Name: campo Name conforme especificado pelo usuário
        const name = getField(vals, "Name");

        // UnitPrice: campo UnitPrice conforme especificado pelo usuário
        const rawPrice = getField(vals, "UnitPrice");
        const unitPrice = parseFloat(rawPrice.replace(",", ".")) || 0;

        // IsActive
        const isActiveRaw = getField(vals, "IsActive");
        const isActive = isActiveRaw !== "false" && isActiveRaw !== "0";

        return {
          ProductCode: code.trim(),
          ProductName: name.trim(),
          UnitPrice: unitPrice,
          IsActive: isActive,
        };
      })
      .filter((e) => e.ProductCode !== "");

    priceEntryCache = { data: entries, expiresAt: now + CACHE_TTL };
    console.log(`[SFMC] Mapped ${entries.length} price entries. Sample:`, entries.slice(0, 2));
    return entries;
  } catch (error) {
    console.error("SFMC PricebookEntry Fetch Error:", error);
    return null;
  }
}

// Retrocompatibilidade
export async function fetchSFMCProducts() {
  return fetchSFMCPriceEntries();
}
