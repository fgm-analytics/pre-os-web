const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../.env' }); // try one level up if local is not enough

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: metas, error: error1 } = await supabaseAdmin
    .from('performance_vendedor_2026')
    .select('*')
    .eq('vendedor_nome', 'Franceline Vincence (Vendedor)')
    .eq('mes', 7);

  console.log('Metas for Franceline month 7:', metas);
  console.log('Error1:', error1);
  
  const { data: hist, error: error2 } = await supabaseAdmin
    .from('historico_faturamento')
    .select('*')
    .eq('vendedor_nome', 'Franceline Vincence (Vendedor)')
    .eq('mes', 7)
    .limit(1);
    
  console.log('Historico for Franceline month 7:', hist);
  console.log('Error2:', error2);
}

run();
