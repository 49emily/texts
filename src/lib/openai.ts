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
    content: `You are a helpful assistant named third wheel participating in a group chat. Be friendly, concise, and engaging. Keep responses brief and natural. You can see who sent each message by their phone number. Respond casually in lowercase or in all UPPERCASE if you are excited. Speak in phrases with little punctuation, do not use long paragraphs. Do not respond as anyone else other than the third party assistant. Do not use emojis, but you can use plaintext smilies.

TOOLS: 
- send_message: When you want to reply to the group chat, you MUST use this tool. Do not just provide text responses - always use the tool. You can ONLY put plain text in the send_message tool, NO MARKDOWN. You can send_message 1-3 times in a row, but each should be less than 10 words unless you are sending information from a tool call.
- get_user_histories: Use ONLY WHEN their group message content is related to the group chat members' music and ubereats/doordash order preferences. You can call it multiple times for different group chat members. If someone asks about the preferences of a person with a specific name, you can call this tool for everyone in the group chat to find the correct person (the response will have the first_name). If first_name is \"you\", that is Emily. 
- send_audio_message: Use this when you want to send an audio message to the group chat. You can use this after get_user_histories was called for music preferences. If there is text content related to the audio message, call send_message.

IMPORTANT: Mimic the style of the messages in the group chat as closely as possible. Do not send repetitive messages. Be useful, and don't interject messages in the group chat when not necessary. This is PRIMARILY A GROUP CHAT BETWEEN THE OTHER PEOPLE. When referred to as third wheel, make sure to respond.`,
  };

  try {
    // Initial conversation messages
    const conversationMessages: ChatCompletionMessageParam[] = [
      systemMessage,
      ...formattedMessages,
    ];

    // Make initial API call with tool support
    console.log("🤖 Making initial OpenAI API call...");
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
    console.log("📨 Initial response from OpenAI:");
    console.log(`  - Has tool calls: ${!!responseMessage?.tool_calls}`);
    console.log(`  - Content: ${responseMessage?.content || "(none)"}`);
    if (responseMessage?.tool_calls) {
      console.log(`  - Tool calls (${responseMessage.tool_calls.length}):`);
      responseMessage.tool_calls.forEach((tc, i) => {
        if (tc.type === "function") {
          console.log(
            `    ${i + 1}. ${tc.function.name}(${tc.function.arguments})`
          );
        }
      });
    }

    // Handle tool calls if the model wants to use them
    const maxToolCalls = 10; // Prevent infinite loops
    let toolCallCount = 0;

    while (responseMessage?.tool_calls && toolCallCount < maxToolCalls) {
      toolCallCount++;
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔄 Tool call iteration ${toolCallCount}/${maxToolCalls}`);
      console.log(`${"=".repeat(60)}`);
      console.log(
        `📊 Assistant decided to call ${responseMessage.tool_calls.length} tool(s):`
      );
      responseMessage.tool_calls.forEach((tc, i) => {
        if (tc.type === "function") {
          console.log(`   ${i + 1}. ${tc.function.name}`);
        }
      });

      // Add assistant's message with tool calls to conversation
      conversationMessages.push(responseMessage);
      console.log(
        `\n📝 Added assistant message with ${responseMessage.tool_calls.length} tool calls to conversation history`
      );

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        // Type guard: ensure this is a function tool call
        if (toolCall.type !== "function") {
          console.warn(`Skipping non-function tool call: ${toolCall.type}`);
          continue;
        }

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`\n🔧 Executing tool: ${functionName}`);
        console.log(`   Arguments: ${JSON.stringify(functionArgs, null, 2)}`);

        try {
          // Execute the tool
          const functionResponse = await executeTool(
            functionName,
            functionArgs,
            toolContext
          );

          console.log(`✅ Tool response from ${functionName}:`);
          console.log(
            `   ${functionResponse.substring(0, 2000)}${
              functionResponse.length > 2000 ? "..." : ""
            }`
          );
          console.log(`   Full length: ${functionResponse.length} chars`);

          // Truncate tool response to 2000 characters for context
          const truncatedResponse =
            functionResponse.length > 2000
              ? functionResponse.substring(0, 2000) +
                "\n... (truncated for context)"
              : functionResponse;

          if (functionResponse.length > 2000) {
            console.log(
              `   ✂️  Truncated to ${truncatedResponse.length} chars for conversation context`
            );
          }

          // Add tool response to conversation
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: truncatedResponse,
          });
          console.log(`📝 Added tool response to conversation history`);
        } catch (error: any) {
          console.error(`❌ Error executing tool ${functionName}:`, error);
          // Add error response
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
          console.log(`📝 Added error response to conversation history`);
        }
      }

      // Make another API call with the tool responses
      console.log(
        `\n🤖 Making follow-up OpenAI API call with ${conversationMessages.length} messages in history...`
      );
      console.log(`📋 Conversation history summary:`);
      conversationMessages.forEach((msg, i) => {
        if (msg.role === "system") {
          const content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log(`  ${i}. [SYSTEM] ${content.substring(0, 50)}...`);
        } else if (msg.role === "user") {
          console.log(
            `  ${i}. [USER] ${
              typeof msg.content === "string"
                ? msg.content.substring(0, 100)
                : JSON.stringify(msg.content).substring(0, 100)
            }...`
          );
        } else if (msg.role === "assistant") {
          const content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log(
            `  ${i}. [ASSISTANT] content: ${content || "(none)"}, tool_calls: ${
              msg.tool_calls?.length || 0
            }`
          );
        } else if (msg.role === "tool") {
          const content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log(`  ${i}. [TOOL] ${content.substring(0, 100)}...`);
        }
      });

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
      console.log(`\n📨 Response from OpenAI (iteration ${toolCallCount}):`);
      console.log(`  - Has tool calls: ${!!responseMessage?.tool_calls}`);
      console.log(`  - Content: ${responseMessage?.content || "(none)"}`);
      if (responseMessage?.tool_calls) {
        console.log(`  - Tool calls (${responseMessage.tool_calls.length}):`);
        responseMessage.tool_calls.forEach((tc, i) => {
          if (tc.type === "function") {
            console.log(
              `    ${i + 1}. ${tc.function.name}(${tc.function.arguments})`
            );
          }
        });
      }
    }

    if (toolCallCount >= maxToolCalls) {
      console.log(
        `\n⚠️  Reached maximum tool call iterations (${maxToolCalls})`
      );
    } else if (!responseMessage?.tool_calls) {
      console.log(`\n✅ No more tool calls - assistant is done`);
    }

    // Extract final text response
    const response = responseMessage?.content;
    console.log(`\n🎯 Final response content: ${response || "(none)"}`);
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
