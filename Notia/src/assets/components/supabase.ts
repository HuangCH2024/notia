import { createClient } from '@supabase/supabase-js';  

//Need your a link of your supabase and a public key, you can get them from your supabase project settings. 
// Don't worry about the security of the key, it's meant to be public and only allows read/write access to 
// the database according to the rules you set up in Supabase.
const supabaseUrl = 'https://zdtrckssxpoimdeekdfq.supabase.co';
const supabaseKey = 'sb_publishable_HPs6pAv7BQKs3Xp4YDIA_w_J0ozkRd9';

export const supabase = createClient(supabaseUrl, supabaseKey);