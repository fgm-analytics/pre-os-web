const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUsers() {
  const usersToFix = [
    {
      email: 'fabricio.costa@fgmdentalgroup.com',
      vendedor_code: 993,
      salesforce_id: '005V200000K2sK9IAJ',
      nome: 'Fabricio Cunha Costa',
      role: 'vendedor'
    },
    {
      email: 'marcio@fgmdentalgroup.com',
      vendedor_code: 75,
      salesforce_id: '005V200000K2rxZIAR',
      nome: 'Marcio Vieira Reis Oliveira',
      role: 'vendedor'
    }
  ];

  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Erro ao listar usuários do auth:', listError.message);
    return;
  }

  for (const userConfig of usersToFix) {
    const authUser = authUsers.users.find(u => u.email === userConfig.email);
    
    if (!authUser) {
      console.log(`Usuário ${userConfig.email} não encontrado no Auth. Pule a inserção.`);
      continue;
    }

    console.log(`Inserindo/Atualizando ${userConfig.email} na tabela usuarios...`);

    const { data: profileData, error: profileError } = await supabase
      .from('usuarios')
      .upsert({
        id: authUser.id,
        email: userConfig.email,
        vendedor_code: userConfig.vendedor_code,
        salesforce_id: userConfig.salesforce_id,
        nome: userConfig.nome,
        role: userConfig.role
      }, { onConflict: 'email' })
      .select();

    if (profileError) {
      console.error(`Erro ao atualizar ${userConfig.email}:`, profileError.message);
    } else {
      console.log(`Perfil de ${userConfig.email} atualizado com sucesso!`);
    }
  }
}

fixUsers();
