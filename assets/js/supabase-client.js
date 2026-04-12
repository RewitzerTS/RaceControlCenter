const SUPABASE_URL = 'https://kjccstcbqygxuqkvdaqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY2NzdGNicXlneHVxa3ZkYXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4NzYsImV4cCI6MjA5MDY0MTg3Nn0.7aojXjXa4nfHRiT8CrGo6tX-lqAxYQ6mCMaHLhjo1J8';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'rcc_admin_session'
  }
});
