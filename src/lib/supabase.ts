import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";

// Client-side client (uses publishable key - safe for browser)
// Use this in React components, client components, etc.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side client (uses secret key - privileged access)
// Use this in API routes, server components, etc.
export function createServerClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY"
    );
  }
  return createClient(supabaseUrl, supabaseSecretKey);
}

// Export server client instance
export const supabaseServer = createServerClient();
