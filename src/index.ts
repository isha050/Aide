import { handleRequest } from "./router";
import type { Request } from "./types";

// Temporary local test helper so you can call it from terminal/REPL
async function test() {
  const sample: Request = {
    text: "Book a meeting with eng and design for incident review",
    userId: "user-123",
    timestamp: new Date().toISOString(),
  };

  const result = await handleRequest(sample);
  console.log(JSON.stringify(result, null, 2));
}

// Run the test when you start the process
test().catch(console.error);

// Keep the original NitroStack bootstrap if the starter has one.
// If the starter exports a server, leave it; otherwise this is enough for solo testing.