import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client-side client (uses anon key - safe for browser)
// Use this in React components, client components, etc.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (uses service_role key - privileged access, bypasses RLS)
// Use this in API routes, server components, etc.
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

// Export server client instance
export const supabaseServer = createServerClient();
