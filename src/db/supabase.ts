import { createClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined): string {
  if (!value) return "";

  return value
    .trim()
    .replace(/^VITE_SUPABASE_URL=/, "")
    .replace(/^VITE_SUPABASE_ANON_KEY=/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl.startsWith("https://")) {
  console.error("[LeaveSync] Invalid Supabase URL:", supabaseUrl);
  throw new Error("Invalid Supabase URL. Check VITE_SUPABASE_URL in Vercel.");
}

if (!supabaseAnonKey) {
  console.error("[LeaveSync] Missing Supabase anon key");
  throw new Error("Missing Supabase anon key. Check VITE_SUPABASE_ANON_KEY in Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
