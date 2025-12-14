import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { sendGroupMessage, sendGroupAudioMessage } from "./loopmessage";
import { getInternalHistories } from "./homie";
/**
 * Tool definitions for the OpenAI agent
 * Add new tools here to extend agent capabilities
 */
export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_message",
      description:
        "Send a message to the group chat. Use this to respond to the conversation.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The message text to send to the group",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_histories",
      description:
        "Get internal user histories for food or music preferences based on their phone number. Use the phone number from the group chat. Returns engagement history including likes and recent interactions.",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description:
              "The phone number of the user. Include the +1 prefix. Use the phone numbers from the group chat.",
          },
          category: {
            type: "string",
            enum: ["food", "music", "video"],
            description: "The category of histories to retrieve: food or music",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of history items to return (default: 20)",
            default: 20,
          },
        },
        required: ["phone_number", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_audio_message",
      description:
        "Send an audio or voice message to the group chat. The audio file must be hosted at a publicly accessible HTTPS URL. Supported formats: mp3, wav, m4a, caf, aac. Use this only after get_user_histories was called for music preferences.",
      parameters: {
        type: "object",
        properties: {
          // text: {
          //   type: "string",
          //   description: "A text description of the audio message",
          // },
          media_url: {
            type: "string",
            description:
              "The full HTTPS URL of the audio file (must start with https://). Max length: 256 characters. Must be publicly accessible without authentication.",
          },
        },
        required: ["text", "media_url"],
      },
    },
  },
];

/**
 * Context passed to tool executors
 */
export interface ToolContext {
  groupId: string;
  senderName: string;
}

/**
 * Tool execution handlers
 * Implement the actual logic for each tool here
 */
interface ToolExecutor {
  [key: string]: (args: any, context: ToolContext) => Promise<string>;
}

export const toolExecutors: ToolExecutor = {
  send_message: async (args: { text: string }, context: ToolContext) => {
    try {
      await sendGroupMessage(context.groupId, args.text, context.senderName);
      return JSON.stringify({
        success: true,
        message: "Message sent successfully",
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to send message",
      });
    }
  },
  get_user_histories: async (
    args: {
      phone_number: string;
      category: "food" | "music" | "video";
      limit?: number;
    },
    context: ToolContext
  ) => {
    try {
      const apiKey = process.env.HOMIE_API_KEY;
      if (!apiKey) {
        throw new Error("HOMIE_API_KEY environment variable is not set");
      }

      // Normalize phone number: remove dashes and spaces, ensure +1 prefix
      const normalizedPhone = args.phone_number.replace(/[-\s]/g, "");
      console.log(`Normalized phone number: ${normalizedPhone}`);
      const response = await getInternalHistories({
        auth: {
          phone_number: "+19709992198",
          api_key: apiKey,
        },
        scope: "network",
        filters: {
          data_source_categories: [args.category],
          phone_numbers: [{ phone_number: normalizedPhone }],
        },
        limit: args.limit || 20,
      });

      return JSON.stringify({
        success: true,
        count: response.items.length,
        items: response.items,
        has_more: response.cursor !== null,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to fetch user histories",
      });
    }
  },
  send_audio_message: async (
    args: { media_url: string },
    context: ToolContext
  ) => {
    try {
      // Validate that the URL starts with https://
      if (!args.media_url.startsWith("https://")) {
        throw new Error("media_url must start with https://");
      }

      // Validate URL length
      if (args.media_url.length > 256) {
        throw new Error("media_url must be less than 256 characters");
      }

      await sendGroupAudioMessage(
        context.groupId,
        "Audio message",
        args.media_url,
        context.senderName
      );

      return JSON.stringify({
        success: true,
        message: "Audio message sent successfully",
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to send audio message",
      });
    }
  },
};

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<string> {
  const executor = toolExecutors[toolName];
  if (!executor) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return await executor(args, context);
}
