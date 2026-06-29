/* eslint-disable @typescript-eslint/no-explicit-any */
// SFMC Integration — Fonte: PricebookEntry_Salesforce
// Pricebook2Id = 01sV20000016SsKIAU (lista de preços oficial FGM)
// Campos esperados no Data Extension:
//   keys.ProductCode  → código do produto (= Material no SAP/ERP)
//   values.Name       → nome do produto
//   values.UnitPrice  → preço de tabela
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
  const authUrl = process.env.SFMC_AUTH_URI || process.env.SFMC_AUTH_BASE_URL;

  if (!clientId || !clientSecret || !authUrl) {
    console.error("SFMC Auth variables missing:", { clientId: !!clientId, clientSecret: !!clientSecret, authUrl: !!authUrl });
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
 * Busca produtos e preços da Data Extension DE_PricebookZ3 no SFMC.
 * Esta DE já contém os preços da tabela oficial.
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
  const deKey = "DE_PricebookZ3";

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

    const entries: SFMCPriceEntry[] = items
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

interface SFMCProductRow {
  keys: {
    ProductCode?: string;
    productcode?: string;
  };
  values: {
    ProductCode?: string;
    productcode?: string;
    Description?: string;
    description?: string;
    promotionname?: string;
    promotionName?: string;
    promotionisactive?: string;
    promotionIsActive?: string;
  };
}

interface SFMCRowsetResponse {
  items: SFMCProductRow[];
}

let productsCache: CacheEntry<SFMCProductRow[]> | null = null;

export async function fetchSFMCProducts(): Promise<SFMCProductRow[] | null> {
  const now = Date.now();
  if (productsCache && productsCache.expiresAt > now) {
    return productsCache.data;
  }

  const tokenData = await getSFMCToken();
  if (!tokenData) return null;

  const restUrl = process.env.SFMC_REST_URI || tokenData.rest_instance_url;
  const deKey = "DE_CATALOGO_PRODUTO_PROMOCAO";

  try {
    const res = await fetch(`${restUrl.replace(/\/$/, "")}/data/v1/customobjectdata/key/${deKey}/rowset`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Data fetch failed with status ${res.status}`);
    }

    const data = (await res.json()) as SFMCRowsetResponse;
    const items = data.items || [];
    productsCache = {
      data: items,
      expiresAt: now + CACHE_TTL,
    };
    return items;
  } catch (error) {
    console.error("SFMC Fetch Error:", error);
    return null;
  }
}

/**
 * Busca todos os registros de uma Data Extension paginando de 2500 em 2500
 */
export async function fetchSFMCDataExtensionPaginated(deKey: string): Promise<any[] | null> {
  const tokenData = await getSFMCToken();
  if (!tokenData) return null;

  const restUrl = process.env.SFMC_REST_URI || tokenData.rest_instance_url;
  let allItems: any[] = [];
  let page = 1;
  const pageSize = 2500;
  let hasMore = true;

  try {
    while (hasMore) {
      const res = await fetch(
        `${restUrl.replace(/\/$/, "")}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=${pageSize}&$page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 404 || res.status === 400) {
          console.warn(`[SFMC] DE ${deKey} não encontrada ou erro na página ${page} (${res.status}). Retornando o que tem.`);
          break;
        }
        throw new Error(`Data fetch failed: ${res.status}`);
      }

      const data = await res.json();
      const items: any[] = data.items || [];
      
      if (items.length > 0) {
        // SFMC API returns { keys: {...}, values: {...} }. Merge them for easier parsing
        const mergedItems = items.map((item: any) => ({
          ...item.keys,
          ...item.values,
        }));
        allItems = allItems.concat(mergedItems);
      }

      if (items.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`[SFMC] Fetched ${allItems.length} total rows from ${deKey}`);
    return allItems;
  } catch (error) {
    console.error(`SFMC DE ${deKey} Fetch Error:`, error);
    return null;
  }
}
