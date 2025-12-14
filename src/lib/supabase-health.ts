import { supabaseServer } from "./supabase";

/**
 * Check Supabase connection health
 * Useful for debugging production issues
 */
export async function checkSupabaseHealth() {
  try {
    console.log("Checking Supabase connection...");
    console.log("Using URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log(
      "Secret key present:",
      !!process.env.SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SECRET_KEY?.substring(0, 15) + "..."
    );

    // Try a simple query with timeout
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout after 5s")), 5000)
    );

    const query = supabaseServer.from("messages").select("id").limit(1);

    const { data, error } = (await Promise.race([query, timeout])) as any;

    if (error) {
      console.error("Supabase query failed:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      return false;
    }

    console.log("✅ Supabase connection healthy");
    return true;
  } catch (error: any) {
    console.error("❌ Supabase health check failed:", error.message);
    return false;
  }
}
