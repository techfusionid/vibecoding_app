import Sandbox from "@e2b/code-interpreter";
import { AgentResult, TextMessage } from "@inngest/agent-kit";

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  return sandbox;
}

export function extractTaskSummary(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === "assistant",
  );

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined;

  if (!message?.content) return undefined;

  // Handle array of content blocks
  let rawContent: string;
  if (typeof message.content === "string") {
    rawContent = message.content;
  } else {
    // Filter out thinking/reflection blocks and join only text blocks
    rawContent = message.content
      .filter((c) => "text" in c) // Only keep content blocks with text property
      .map((c) => c.text)
      .join("");
  }

  if (!rawContent) return undefined;

  // Remove <task_summary>...</task_summary> tags and their content
  const cleanedContent = rawContent
    .replace(/<task_summary>[\s\S]*?<\/task_summary>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // Remove thinking tags if present
    .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
    .trim();

  return cleanedContent || undefined;
}
