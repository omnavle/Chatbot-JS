import "dotenv/config";
import readline from "node:readline/promises";

import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearch } from "@langchain/tavily";

const tool = new TavilySearch({
  maxResults: 3,
  topic: "general",
});

const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  maxRetries: 2,
}).bindTools([tool]);

const toolNode = new ToolNode([tool]);

async function callModel(state) {
  const response = await llm.invoke(state.messages);
  return {
    messages: [response],
  };
}

function shouldContinue(state) {
  const lastMessage = state.messages.at(-1);

  return lastMessage.tool_calls?.length
    ? "tools"
    : "__end__";
}

const app = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .compile();

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await rl.question("You: ");

    if (input === "/bye") {
      break;
    }

    const result = await app.invoke({
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
    });

    console.log(
      "AI:",
      result.messages.at(-1).content
    );
  }

  rl.close();
}

export { app };