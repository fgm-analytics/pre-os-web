import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env da raiz do projeto Next.js
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function forceSyncAndClearCache() {
  console.log('1. Limpando cache do Redis...');
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await axios.post(`${REDIS_URL}/DEL/tabela_precos_dwh_v1`, {}, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      console.log('Cache Redis apagado com sucesso!');
    } catch (e) {
      console.log('Erro ao limpar Redis:', e instanceof Error ? e.message : String(e));
    }
  }

  console.log('\n2. Chamando endpoint local de Sincronização SFMC -> Supabase...');
  console.log('Certifique-se de que o servidor Next.js local (npm run dev) está rodando na porta 3000!');
  console.log('Ou você pode acessar manualmente no navegador da sua Vercel:');
  console.log('https://[SUA-URL-DA-VERCEL]/api/cron/sync-sfmc-dwh');
  
}

forceSyncAndClearCache();
