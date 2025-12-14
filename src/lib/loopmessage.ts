interface SendMessagePayload {
  group: string;
  text: string;
  sender_name: string;
}

/**
 * Send a message to an iMessage group via LoopMessage API
 * @param groupId - The iMessage group ID
 * @param text - The message text to send
 * @param senderName - The dedicated sender name
 * @returns Promise with the API response
 */
export async function sendGroupMessage(
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
