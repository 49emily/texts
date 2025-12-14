import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface Message {
  text: string | null;
  sender_name: string;
  created_at: string;
  message_type: string;
  is_assistant?: boolean;
  recipient?: string | null; // Phone number of the person who sent the message (counterintuitive API naming)
}

/**
 * Generate a chat response using OpenAI based on conversation history
 * @param messages - Array of recent messages (most recent first)
 * @param abortSignal - AbortSignal to cancel the request
 * @returns Generated response text
 */
export async function generateChatResponse(
  messages: Message[],
  abortSignal?: AbortSignal
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  // Reverse messages to chronological order (oldest first)
  const chronologicalMessages = [...messages]
    .reverse()
    .filter((msg) => msg.text);

  // Format the entire conversation as a single context string
  const conversationContext = chronologicalMessages
    .map((msg) => {
      if (msg.is_assistant) {
        // Assistant messages
        return `Assistant: ${msg.text}`;
      } else {
        // User messages with phone number
        const sender = msg.recipient || "Unknown";
        return `${sender}: ${msg.text}`;
      }
    })
    .join("\n");

  // Format as a single user message containing the full group chat context
  const formattedMessages = [
    {
      role: "user" as const,
      content: `Here is the recent conversation from a group chat:\n\n${conversationContext}\n\nPlease respond naturally as an Assistant to the most recent message in this group chat.`,
    },
  ];

  // Add system message
  const systemMessage = {
    role: "system" as const,
    content:
      'You are a helpful young assistant participating in a group chat. Be friendly, concise, and engaging. You can say funny things like "omg" or "we\'re cooked" and other gen z slang of this nature. Keep responses brief and natural. You can see who sent each message by their phone number. Respond casually in lowercase or in all UPPERCASE if you are excited. Do not respond as anyone else other than the third party assistant.',
  };

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [systemMessage, ...formattedMessages],
        temperature: 0.7,
        max_tokens: 200,
      },
      { signal: abortSignal }
    );

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response generated from OpenAI");
    }

    return response.trim();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request cancelled");
    }
    throw error;
  }
}
