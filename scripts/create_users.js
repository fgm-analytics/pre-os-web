const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUsers() {
  const usersToCreate = [
    { email: 'marcio@fgmdentalgroup.com', password: 'Password123!' },
    { email: 'fabricio.costa@fgmdentalgroup.com', password: 'Password123!' }
  ];

  for (const user of usersToCreate) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });

    if (error) {
      console.error(`Error creating user ${user.email}:`, error.message);
    } else {
      console.log(`User created successfully: ${user.email} (ID: ${data.user.id})`);
    }
  }
}

createUsers();
