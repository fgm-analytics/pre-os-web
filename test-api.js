process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function executeTool(name, args, vendedorCode) {
  if (name === 'get_status_meta') {
    const currentMonth = 7; 
    
    if (!vendedorCode) return { error: "Vendedor não encontrado no banco de dados." };

    const { data: metas, error } = await supabaseAdmin
      .from('performance_vendedor_2026')
      .select('meta_faturamento, realizado_faturamento')
      .eq('vendedor_code', vendedorCode)
      .eq('mes', currentMonth);

    if (error) {
      console.log('Error querying:', error);
    }

    let totalMeta = 0;
    let totalRealizado = 0;
    
    if (metas) {
      metas.forEach((m) => {
        totalMeta += Number(m.meta_faturamento || 0);
        totalRealizado += Number(m.realizado_faturamento || 0);
      });
    }
    
    const atingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    
    return { 
      meta_mensal: `R$ ${totalMeta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
      realizado: `R$ ${totalRealizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
      atingimento: `${atingimento.toFixed(1)}%`,
      status: atingimento >= 100 ? "Meta Batida!" : (atingimento > 80 ? "Na média" : "Abaixo do esperado")
    };
  }
}

async function test() {
  const res = await executeTool('get_status_meta', {}, 107);
  console.log(res);
}

test();
