import { NextRequest, NextResponse } from "next/server";

interface LoopMessageWebhook {
  alert_type: string;
  message_id: string;
  webhook_id: string;
  recipient?: string;
  text?: string;
  sender_name?: string;
  group?: {
    group_id: string;
    name?: string;
    participants: string[];
  };
}

interface SendMessagePayload {
  group: string;
  text: string;
  sender_name: string;
}

async function sendGroupMessage(
  groupId: string,
  text: string,
  senderName: string
) {
  const payload: SendMessagePayload = {
    group: groupId,
    text: text,
    sender_name: senderName,
  };

  const response = await fetch(
    "https://server.loopmessage.com/api/v1/message/send/",
    {
      method: "POST",
      headers: {
        Authorization: process.env.LOOPMESSAGE_AUTH_KEY || "",
        "Loop-Secret-Key": process.env.LOOPMESSAGE_SECRET_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Failed to send message:", error);
    throw new Error(
      `Failed to send message: ${error.message || "Unknown error"}`
    );
  }

  return response.json();
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

      // Send "hi group!!" message
      await sendGroupMessage(groupId, "hi group!!", senderName);
      console.log("Sent welcome message to group");
    }

    // Handle message_inbound event (only for groups)
    else if (webhook.alert_type === "message_inbound") {
      console.log("Inbound message in group:", groupId);

      // Send "hiiii" message
      await sendGroupMessage(groupId, "hiiii", senderName);
      console.log("Sent reply to group");
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
