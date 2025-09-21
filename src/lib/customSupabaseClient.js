import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gkzejnlyinqvzrtkjtzx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdremVqbmx5aW5xdnpydGtqdHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MDAyNDcsImV4cCI6MjA3MzA3NjI0N30.SEksddJfhPe5R9eRbUq5h8xPM-czOu_PF7q4F6LQN0I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);