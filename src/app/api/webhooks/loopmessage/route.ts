import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { sendGroupMessage } from "@/lib/loopmessage";
import { generateChatResponse } from "@/lib/openai";
import { requestManager } from "@/lib/request-manager";
import { checkSupabaseHealth } from "@/lib/supabase-health";

interface LoopMessageWebhook {
  alert_type: string;
  message_id: string;
  webhook_id: string;
  recipient?: string;
  text?: string;
  sender_name?: string;
  message_type?: string;
  attachments?: string[];
  success?: boolean;
  group?: {
    group_id: string;
    name?: string;
    participants: string[];
  };
}

/**
 * Process message asynchronously: save, fetch history, generate response, send
 */
async function processMessageAsync(
  webhook: LoopMessageWebhook,
  groupId: string,
  senderName: string,
  abortSignal: AbortSignal
) {
  try {
    console.log("Starting async message processing for group:", groupId);

    // Run health check on first message
    if (process.env.NODE_ENV === "production") {
      await checkSupabaseHealth();
    }

    // Save message to Supabase with timeout
    console.log("Saving message to database...");

    const savePromise = supabaseServer.from("messages").insert({
      message_id: webhook.message_id,
      webhook_id: webhook.webhook_id,
      group_id: groupId,
      group_name: webhook.group?.name || null,
      sender_name: senderName,
      recipient: webhook.recipient || null,
      text: webhook.text || null,
      message_type: webhook.message_type || "text",
      alert_type: webhook.alert_type,
      attachments: webhook.attachments || null,
      participants: webhook.group?.participants || [],
      is_assistant: false, // Inbound messages are from users, not assistant
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database insert timeout after 10s")),
        10000
      )
    );

    try {
      const { error: dbError } = (await Promise.race([
        savePromise,
        timeoutPromise,
      ])) as any;

      if (dbError) {
        console.error("❌ Error saving message to database:", dbError);
        console.error("Error code:", dbError.code);
        console.error("Error details:", dbError.details);
        console.error("Error hint:", dbError.hint);
        console.error("Error message:", dbError.message);
        // Continue anyway - don't block processing
      } else {
        console.log("✅ Message saved to database:", webhook.message_id);
      }
    } catch (timeoutError: any) {
      console.error("⏱️ Database operation timed out:", timeoutError.message);
      console.error("This usually indicates:");
      console.error(
        "1. Wrong Supabase key (using publishable instead of secret)"
      );
      console.error("2. RLS policies blocking the insert");
      console.error("3. Network connectivity issues");
      // Continue anyway - don't block processing
    }

    // Check if request was cancelled
    if (abortSignal.aborted) {
      console.log("Request cancelled before fetching messages");
      return;
    }

    // Fetch the 10 most recent messages for this group
    console.log("Fetching recent messages...");
    const { data: recentMessages, error: fetchError } = await supabaseServer
      .from("messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error("Error fetching recent messages:", fetchError);
      return;
    }

    if (!recentMessages || recentMessages.length === 0) {
      console.log("No messages found for group");
      return;
    }

    console.log(`Found ${recentMessages.length} recent messages`);

    // Check if request was cancelled
    if (abortSignal.aborted) {
      console.log("Request cancelled before generating response");
      return;
    }

    console.log(`\n📨 Generating response for Group ${groupId}`);
    console.log(`Using ${recentMessages.length} recent messages`);

    // Generate OpenAI response
    console.log("Calling OpenAI...");
    const aiResponse = await generateChatResponse(
      recentMessages.map((msg) => ({
        text: msg.text,
        sender_name: msg.sender_name,
        created_at: msg.created_at,
        message_type: msg.message_type,
        is_assistant: msg.is_assistant || false,
        recipient: msg.recipient, // Phone number of the person who sent the message
      })),
      abortSignal
    );

    // Check if request was cancelled after generation
    if (abortSignal.aborted) {
      console.log("Request cancelled after generating response");
      return;
    }

    console.log(`Generated response: ${aiResponse}`);

    // Send the generated response
    console.log("Sending response to group...");
    await sendGroupMessage(groupId, aiResponse, senderName);
    console.log("Sent AI-generated reply to group");

    // Clean up abort controller
    requestManager.remove(groupId);
    console.log("Message processing completed successfully");
  } catch (error: any) {
    // Clean up abort controller on error
    requestManager.remove(groupId);

    if (error.message === "Request cancelled") {
      console.log("Request was cancelled");
      return;
    }

    console.error("Error processing message:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const webhook: LoopMessageWebhook = await request.json();

    console.log("Received webhook:", webhook.alert_type, webhook.webhook_id);
    console.log("Webhook:", webhook);

    // Verify we have group data
    if (!webhook.group?.group_id) {
      console.log("No group data in webhook, ignoring");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const groupId = webhook.group.group_id;
    const senderName =
      webhook.sender_name || process.env.LOOPMESSAGE_SENDER_NAME || "";

    // Handle group_created event
    if (webhook.alert_type === "group_created") {
      console.log("Group created:", groupId);

      //   // Send "hi group!!" message
      //   await sendGroupMessage(groupId, "hi group!!", senderName);
      //   console.log("Sent welcome message to group");
    }

    // Handle message_inbound event (only for groups)
    else if (webhook.alert_type === "message_inbound") {
      console.log("Inbound message in group:", groupId);

      // Cancel any previous request for this group and create new abort controller
      const abortController = requestManager.cancelAndCreate(groupId);

      // Process message generation asynchronously (don't await)
      processMessageAsync(
        webhook,
        groupId,
        senderName,
        abortController.signal
      ).catch((error) => {
        console.error("Error in async message processing:", error);
        console.error("Error stack:", error.stack);
      });

      // Return immediately to acknowledge webhook
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle message_sent event - store sent messages
    else if (webhook.alert_type === "message_sent") {
      console.log("Message sent:", webhook.message_id);

      // For group messages, we need to find the group_id
      // Try to get it from the webhook group field first
      let groupIdForSent = webhook.group?.group_id;

      //   // If no group in webhook, try to find it from recent messages
      //   if (!groupIdForSent) {
      //     // Look up the group_id from recent messages sent by our sender within the last 5 minutes
      //     // This handles the case where message_sent webhook doesn't include group info
      //     const fiveMinutesAgo = new Date(
      //       Date.now() - 5 * 60 * 1000
      //     ).toISOString();

      //     const { data: recentSentMessage } = await supabaseServer
      //       .from("messages")
      //       .select("group_id")
      //       .eq("sender_name", senderName)
      //       .eq("is_assistant", true)
      //       .not("group_id", "is", null)
      //       .gte("created_at", fiveMinutesAgo)
      //       .order("created_at", { ascending: false })
      //       .limit(1)
      //       .single();

      //     if (recentSentMessage?.group_id) {
      //       groupIdForSent = recentSentMessage.group_id;
      //       console.log(`Found group_id from recent messages: ${groupIdForSent}`);
      //     }
      //   }

      // Only save if we have group_id or if it's a direct message (recipient without group)
      if (groupIdForSent || webhook.recipient) {
        const { error: dbError } = await supabaseServer
          .from("messages")
          .insert({
            message_id: webhook.message_id,
            webhook_id: webhook.webhook_id,
            group_id: groupIdForSent || null,
            group_name: webhook.group?.name || null,
            sender_name: senderName,
            recipient: webhook.recipient || null,
            text: webhook.text || null,
            message_type: webhook.message_type || "text",
            alert_type: webhook.alert_type,
            attachments: webhook.attachments || null,
            participants: webhook.group?.participants || [],
            is_assistant: true, // Sent messages are from assistant
          });

        if (dbError) {
          console.error("Error saving sent message to database:", dbError);
        } else {
          console.log("Sent message saved to database:", webhook.message_id);
        }
      } else {
        console.log(
          "Skipping sent message save - no group_id or recipient found"
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Return 200 status to acknowledge webhook receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Still return 200 to prevent retries for our internal errors
    // You might want to change this depending on your error handling strategy
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
