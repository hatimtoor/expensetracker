/**
 * Supabase configuration.
 *
 * To enable cloud sync:
 *   1. Create a project at https://supabase.com
 *   2. In the SQL editor, run the script in `supabase/schema.sql`
 *   3. Open Project Settings -> API and copy your Project URL and anon public key
 *   4. Paste them below and reload the page.
 *
 * Leave these empty to run in "local storage only" mode — the app works fully
 * offline and stores every saved month in your browser.
 *
 * NOTE: The anon key is safe to expose in the browser *only* when Row Level
 * Security (RLS) is enabled on your table (the schema.sql does this). For a
 * personal, single-user tracker the provided permissive policy is fine; add
 * Supabase Auth if you deploy this for multiple people.
 */
window.SUPABASE_CONFIG = {
  url: "https://ehwjktquodswhmqzbgch.supabase.co",      // e.g. "https://xxxxxxxxxxxx.supabase.co"
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVod2prdHF1b2Rzd2htcXpiZ2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMzY5NjEsImV4cCI6MjA5ODcxMjk2MX0.rbhOTgeQpq4OC-8apTQN_Vid1lQQK8e_pMBpkHQrbrg",  // e.g. "eyJhbGciOi..."
  table: "monthly_records",
};
