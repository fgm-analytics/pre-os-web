process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: metas, error: e1 } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('vendedor_code, vendedor_nome, mes, meta_faturamento, realizado_faturamento')
    .eq('vendedor_code', 107)
    .eq('mes', 7);

  console.log('Metas Franceline mes 7 (Code 107):', metas, 'Error:', e1);
  
  const { data: allMonths, error: e2 } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('vendedor_code, mes')
    .eq('vendedor_code', 107);
    
  console.log('Months available for Franceline:', Array.from(new Set(allMonths?.map(x => x.mes) || [])));
}

run();
