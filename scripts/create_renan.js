const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createRenan() {
  const email = 'renan.ferreira@fgm.ind.br';
  const password = 'Password123!';
  const nome = 'Renan Freitas Ferreira';
  const vendedor_code = 1031;
  const salesforce_id = '005Hu00000SSHdmIAH';

  console.log(`Criando usuário auth para ${email}...`);
  
  // 1. Criar usuário no Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log(`Usuário ${email} já existe no Auth.`);
    } else {
      console.error('Erro ao criar usuário auth:', authError.message);
      return;
    }
  } else {
    console.log(`Usuário auth criado com sucesso! ID: ${authData.user.id}`);
  }

  // Obter o ID do usuário (criado agora ou já existente)
  const { data: existingUser } = await supabase.auth.admin.listUsers();
  const user = existingUser?.users.find(u => u.email === email) || authData?.user;

  if (!user) {
    console.error('Não foi possível obter o ID do usuário auth.');
    return;
  }

  console.log(`Inserindo perfil na tabela usuarios para ID ${user.id}...`);

  // 2. Inserir na tabela usuarios
  const { data: profileData, error: profileError } = await supabase
    .from('usuarios')
    .upsert({
      id: user.id,
      email: email,
      vendedor_code: vendedor_code,
      salesforce_id: salesforce_id,
      nome: nome,
      role: 'vendedor'
    }, { onConflict: 'email' })
    .select();

  if (profileError) {
    console.error('Erro ao criar perfil na tabela usuarios:', profileError.message);
  } else {
    console.log('Perfil de vendedor criado/atualizado com sucesso na tabela usuarios!');
    console.log(profileData);
  }
}

createRenan();
