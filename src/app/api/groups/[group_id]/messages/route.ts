import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { group_id: groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Validate limit
    const validLimit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100
    const validOffset = Math.max(offset, 0);

    // Always fetch most recent messages first (ordered by created_at DESC)
    // Offset 0 = most recent messages, increasing offset = older messages
    const query = supabaseServer
      .from("messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range(validOffset, validOffset + validLimit - 1);

    const { data: messages, error, count } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages", details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count: totalCount } = await supabaseServer
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupId);

    return NextResponse.json({
      messages: messages || [],
      pagination: {
        limit: validLimit,
        offset: validOffset,
        total: totalCount || 0,
        has_more: (totalCount || 0) > validOffset + validLimit,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/groups/[group_id]/messages:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
