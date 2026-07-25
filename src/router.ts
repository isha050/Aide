import type {
  Request,
  RouterOutput,
  MeetingSlotResult,
  TaskAssignment,
  AdminDecision,
  DraftedMessage,
} from "./types";

// ========== STUBS (hardcoded – do NOT call real agents yet) ==========
const stubSchedulingResult: MeetingSlotResult = {
  time: "2025-01-15T14:00:00Z",
  attendees: ["alice", "bob", "charlie"],
  duration: 60,
  confidence: "high",
};

const stubDelegationResult: TaskAssignment = {
  taskId: "task-001",
  owner: "alice",
  deadline: "2025-01-17T17:00:00Z",
  priority: "high",
  reasoning: "Alice has lowest current workload on this domain.",
};

const stubAdminResult: AdminDecision = {
  approved: true,
  reason: "Request within policy limits.",
  escalationRequired: false,
};

// ========== MAIN ROUTER ==========
export async function handleRequest(req: Request): Promise<RouterOutput> {
  // 1. Read the request text
  const text = req.text.toLowerCase();

  // 2. Synchronously decide which sub-tasks are needed
  const needsScheduling =
    text.includes("meeting") ||
    text.includes("schedule") ||
    text.includes("book") ||
    text.includes("slot");

  const needsDelegation =
    text.includes("task") ||
    text.includes("assign") ||
    text.includes("who") ||
    text.includes("owner");

  const needsAdmin =
    text.includes("approve") ||
    text.includes("expense") ||
    text.includes("access") ||
    text.includes("policy") ||
    text.includes("escalat");

  // 3. Call stubs (hardcoded mock returns that match the contracts exactly)
  const schedulingResult = needsScheduling ? stubSchedulingResult : undefined;
  const delegationResult = needsDelegation ? stubDelegationResult : undefined;
  const adminResult = needsAdmin ? stubAdminResult : undefined;

  // 4. Synthesize final message
  const parts: string[] = [];
  if (schedulingResult) {
    parts.push(
      `Meeting booked at ${schedulingResult.time} for ${schedulingResult.attendees.join(", ")} (${schedulingResult.duration} min, confidence: ${schedulingResult.confidence})`
    );
  }
  if (delegationResult) {
    parts.push(
      `Task ${delegationResult.taskId} assigned to ${delegationResult.owner} (deadline ${delegationResult.deadline}, priority ${delegationResult.priority}). Reason: ${delegationResult.reasoning}`
    );
  }
  if (adminResult) {
    parts.push(
      `Admin decision: ${adminResult.approved ? "APPROVED" : "REJECTED"}. ${adminResult.reason}${adminResult.escalationRequired ? " (escalation required)" : ""}`
    );
  }
  if (parts.length === 0) {
    parts.push("No specific action detected. Please clarify the request.");
  }

  const finalMessage: DraftedMessage = {
    text: parts.join("\n"),
    channel: "#general",
    format: "slack",
  };

  // 5. Return full RouterOutput
  return {
    originalRequest: req,
    schedulingResult,
    delegationResult,
    adminResult,
    finalMessage,
  };
}