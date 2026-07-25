import { handleRequest } from "./src/router";
import type { Request } from "./src/types";

async function run() {
  const sample: Request = {
    text: "Book a meeting with eng and design for incident review",
    userId: "user-123",
    timestamp: new Date().toISOString(),
  };

  console.log("=== INPUT ===");
  console.log(sample);

  const result = await handleRequest(sample);

  console.log("\n=== OUTPUT (RouterOutput) ===");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);