import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function generateStrongPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = 4; i < 18; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function createAdminAccount() {
  const username = 'admin_gdsawant';
  const password = generateStrongPassword();
  const fullName = 'G.D Sawant Admin';
  const email = `${username}@miaoda.com`;

  console.log('\n=== Creating Admin Account ===\n');

  try {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
          role: 'staff'
        }
      }
    });

    if (signUpError) throw signUpError;

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    console.log('✓ User created successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', authData.user.id);

    if (updateError) throw updateError;

    console.log('✓ Role updated to admin');

    console.log('\n=== Admin Account Created Successfully ===\n');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Admin Secret Key: GDS2026ADMIN');
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!\n');

  } catch (error) {
    console.error('Error creating admin account:', error.message);
    process.exit(1);
  }
}

createAdminAccount();
