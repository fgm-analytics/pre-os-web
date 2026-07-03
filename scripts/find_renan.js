const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRenan() {
  const { data, error } = await supabase
    .from('historico_faturamento')
    .select('vendedor_code, vendedor_nome')
    .ilike('vendedor_nome', '%Renan%')
    .limit(1);
    
  if (error) {
    console.error('Error finding Renan in historico_faturamento:', error.message);
  } else {
    console.log('Found Renan in historico_faturamento:', data);
  }
}

findRenan();
