import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Validate limit
    const validLimit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100
    const validOffset = Math.max(offset, 0);

    // Get distinct groups with their latest message
    // Always fetch most recent groups first (ordered by latest message created_at DESC)
    const { data: groups, error } = await supabaseServer
      .from("messages")
      .select("group_id, group_name, created_at")
      .order("created_at", { ascending: false })
      .range(validOffset, validOffset + validLimit - 1);

    if (error) {
      console.error("Error fetching groups:", error);
      return NextResponse.json(
        { error: "Failed to fetch groups", details: error.message },
        { status: 500 }
      );
    }

    // Get unique groups with their metadata
    const uniqueGroups = new Map();
    groups?.forEach((msg) => {
      if (!uniqueGroups.has(msg.group_id)) {
        uniqueGroups.set(msg.group_id, {
          group_id: msg.group_id,
          group_name: msg.group_name,
          last_message_at: msg.created_at,
        });
      }
    });

    // Get total count
    const { count: totalCount } = await supabaseServer
      .from("messages")
      .select("group_id", { count: "exact", head: true });

    return NextResponse.json({
      groups: Array.from(uniqueGroups.values()),
      pagination: {
        limit: validLimit,
        offset: validOffset,
        total: totalCount || 0,
        has_more: (totalCount || 0) > validOffset + validLimit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/groups:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
