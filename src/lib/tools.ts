import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { sendGroupMessage } from "./loopmessage";
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
            enum: ["food", "music"],
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
      name: "web_search",
      description:
        "Search the web for current information. Use this when you need real-time data, current events, or information not in your training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up on the web",
          },
        },
        required: ["query"],
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
    args: { phone_number: string; category: "food" | "music"; limit?: number },
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
  web_search: async (args: { query: string }, context: ToolContext) => {
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("TAVILY_API_KEY environment variable is not set");
      }

      console.log(`🔍 Searching web for: ${args.query}`);

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: "basic",
          include_answer: true,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Format results into a readable string
      let result = "";
      if (data.answer) {
        result += `Answer: ${data.answer}\n\n`;
      }

      if (data.results && data.results.length > 0) {
        result += "Sources:\n";
        data.results.forEach((item: any, index: number) => {
          result += `${index + 1}. ${item.title}\n`;
          result += `   ${item.content}\n`;
          result += `   URL: ${item.url}\n\n`;
        });
      }

      return result || "No results found";
    } catch (error: any) {
      console.error("Web search error:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to perform web search",
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
