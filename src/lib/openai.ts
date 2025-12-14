import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { tools, executeTool, type ToolContext } from "./tools";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface Message {
  text: string | null;
  sender_name: string;
  created_at: string;
  message_type: string;
  is_assistant?: boolean;
  participants?: string[];
  recipient?: string | null; // Phone number of the person who sent the message (counterintuitive API naming)
}

/**
 * Generate a chat response using OpenAI based on conversation history
 * @param messages - Array of recent messages (most recent first)
 * @param toolContext - Context for tool execution (groupId, senderName)
 * @param abortSignal - AbortSignal to cancel the request
 * @returns Generated response text
 */
export async function generateChatResponse(
  messages: Message[],
  toolContext: ToolContext,
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
        const groupChatMembers = msg.participants?.map((participant) =>
          participant == "+16463258470" ? "Assistant" : participant
        );
        return `${sender} to ${groupChatMembers?.join(", ")}: ${msg.text}`;
      }
    })
    .join("\n");

  // Format as a single user message containing the full group chat context
  const formattedMessages = [
    {
      role: "user" as const,
      content: `Here is the recent conversation from the group chat:\n\n${conversationContext}`,
    },
  ];

  console.log(`Formatted messages: ${JSON.stringify(formattedMessages)}`);

  // Add system message
  const systemMessage = {
    role: "system" as const,
    content:
      'You are a helpful assistant participating in a group chat. Be friendly, concise, and engaging. You can say funny things like "omg" or "we\'re cooked" and other gen z slang of this nature. Keep responses brief and natural. You can see who sent each message by their phone number. Respond casually in lowercase or in all UPPERCASE if you are excited. Speakin phrases with little punctuation, do not use long paragraphs. Do not respond as anyone else other than the third party assistant. Do not use emojis, but you can use :) and :D \nTOOLS: When you want to reply to the group chat, you MUST use the send_message tool to send your response. Do not just provide text responses - always use the tool. You can ONLY put plain text in the send_message tool, NO MARKDOWN. You should use get_user_histories tool when their is content related to the group chat member\'s music and food preferences. You can call it multiple times for different group chat members. You can send_message 1-3 times in a row. Young people send messages that are really short, and break them up between multiple messages if one message is too long.\n\nMimic the style of the messages in the group chat as closely as possible. Do not send repetitive messages.',
  };

  try {
    // Initial conversation messages
    const conversationMessages: ChatCompletionMessageParam[] = [
      systemMessage,
      ...formattedMessages,
    ];

    // Make initial API call with tool support
    let completion = await openai.chat.completions.create(
      {
        model: "gpt-4.1-nano",
        messages: conversationMessages,
        tools: tools,
        tool_choice: "auto", // Let the model decide when to use tools
        // temperature: 0.7,
        // max_tokens: 200,
      },
      { signal: abortSignal }
    );

    let responseMessage = completion.choices[0]?.message;

    // Handle tool calls if the model wants to use them
    const maxToolCalls = 5; // Prevent infinite loops
    let toolCallCount = 0;

    while (responseMessage?.tool_calls && toolCallCount < maxToolCalls) {
      toolCallCount++;

      // Add assistant's message with tool calls to conversation
      conversationMessages.push(responseMessage);

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        // Type guard: ensure this is a function tool call
        if (toolCall.type !== "function") {
          console.warn(`Skipping non-function tool call: ${toolCall.type}`);
          continue;
        }

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, functionArgs);

        try {
          // Execute the tool
          const functionResponse = await executeTool(
            functionName,
            functionArgs,
            toolContext
          );

          console.log(
            `Function response: ${functionResponse.substring(0, 200)}${
              functionResponse.length > 200 ? "..." : ""
            }`
          );

          // Add tool response to conversation
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: functionResponse,
          });
        } catch (error: any) {
          console.error(`Error executing tool ${functionName}:`, error);
          // Add error response
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      // Make another API call with the tool responses
      completion = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: conversationMessages,
          tools: tools,
          tool_choice: "auto",
          //   temperature: 0.7,
          //   max_tokens: 200,
        },
        { signal: abortSignal }
      );

      responseMessage = completion.choices[0]?.message;
    }

    // Extract final text response
    const response = responseMessage?.content;
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
