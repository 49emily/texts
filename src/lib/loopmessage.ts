interface SendMessagePayload {
  group: string;
  text: string;
  sender_name: string;
}

interface SendAudioMessagePayload {
  group: string;
  text: string;
  media_url: string;
  sender_name: string;
  audio_message: boolean;
  status_callback?: string;
  status_callback_header?: string;
  passthrough?: string;
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

/**
 * Send an audio/voice message to an iMessage group via LoopMessage API
 * @param groupId - The iMessage group ID
 * @param text - The message text description
 * @param mediaUrl - The full HTTPS URL of the audio file (mp3, wav, m4a, caf, aac)
 * @param senderName - The dedicated sender name
 * @param options - Optional parameters (status_callback, status_callback_header, passthrough)
 * @returns Promise with the API response
 */
export async function sendGroupAudioMessage(
  groupId: string,
  text: string,
  mediaUrl: string,
  senderName: string,
  options?: {
    status_callback?: string;
    status_callback_header?: string;
    passthrough?: string;
  }
) {
  const payload: SendAudioMessagePayload = {
    group: groupId,
    text: text,
    media_url: mediaUrl,
    sender_name: senderName,
    audio_message: true,
    ...options,
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
    console.error("Failed to send audio message:", error);
    throw new Error(
      `Failed to send audio message: ${error.message || "Unknown error"}`
    );
  }

  return response.json();
}
