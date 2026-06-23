import { Redis } from '@upstash/redis';

// Inicializa a conexão com o Upstash apenas se as variáveis estiverem presentes
// Caso contrário, usa um objeto mock em desenvolvimento para não quebrar a aplicação se o cache estiver desativado/não configurado.
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  console.warn("⚠️ Credenciais do Upstash Redis não encontradas. O cache será ignorado.");
}

/**
 * Busca dados em cache ou executa o fetcher caso não exista (Cache Aside).
 * 
 * @param key Chave de cache
 * @param fetcher Função para buscar os dados caso o cache seja miss
 * @param ttlSeconds Tempo de expiração do cache em segundos
 * @returns Os dados (do cache ou do banco)
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Se o redis não estiver configurado, passa direto para o fetcher
  if (!redis) {
    return await fetcher();
  }

  try {
    const cachedData = await redis.get<T>(key);
    
    if (cachedData !== null && cachedData !== undefined) {
      // Cache hit
      return cachedData;
    }
  } catch (error) {
    console.error(`Erro ao ler cache para a chave ${key}:`, error);
    // Em caso de erro no Redis, prossegue para buscar do fetcher para evitar indisponibilidade
  }

  // Cache miss ou erro na leitura do cache
  const data = await fetcher();

  if (data !== null && data !== undefined) {
    try {
      // Salva no cache
      await redis.set(key, data, { ex: ttlSeconds });
    } catch (error) {
      console.error(`Erro ao salvar cache para a chave ${key}:`, error);
    }
  }

  return data;
}

export default redis;
