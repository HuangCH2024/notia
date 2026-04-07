import { createClient } from '@supabase/supabase-js';  

//Need your a link of your supabase and a public key, you can get them from your supabase project settings. 
// Don't worry about the security of the key, it's meant to be public and only allows read/write access to 
// the database according to the rules you set up in Supabase.
const supabaseUrl = '#';
const supabaseKey = '#';

export const supabase = createClient(supabaseUrl, supabaseKey);