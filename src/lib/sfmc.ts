

interface SFMCTokenResponse {
  access_token: string;
  rest_instance_url: string;
}

interface SFMCProductRow {
  keys: {
    ProductCode: string;
  };
  values: {
    pricebookid?: string;
    pricebookname?: string;
    OrganizationSales__c?: string;
    pricebookentryid?: string;
    ProductId?: string;
    UnitPrice?: string;
    productid?: string;
    Description?: string;
    promotionid?: string;
    promotionname?: string;
    promotionisactive?: string;
    promotionproductid?: string;
  };
}

interface SFMCRowsetResponse {
  items: SFMCProductRow[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let tokenCache: CacheEntry<SFMCTokenResponse> | null = null;
let productsCache: CacheEntry<SFMCProductRow[]> | null = null;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos em milissegundos

export async function getSFMCToken(): Promise<SFMCTokenResponse | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.data;
  }

  const clientId = process.env.SFMC_CLIENT_ID;
  const clientSecret = process.env.SFMC_CLIENT_SECRET;
  const authUrl = process.env.SFMC_AUTH_URI; // e.g. https://xxxx.auth.marketingcloudapis.com/

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
    tokenCache = {
      data,
      expiresAt: now + CACHE_TTL,
    };
    return data;
  } catch (error) {
    console.error("SFMC Auth Error:", error);
    return null;
  }
}

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
