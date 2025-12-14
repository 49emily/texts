import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { sendGroupMessage } from "./loopmessage";
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
