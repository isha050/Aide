# CONTRACTS.md
Locked Hour 0. Do not change without team agreement.

## find_meeting_slot (Person B)
Input: { attendees: string[], durationMinutes: number, urgency: "low"|"medium"|"high" }
Output: { proposedSlots: string[], conflicts: string[], reasoning: string }

## book_meeting (Person B)
Input: { slot: string, attendees: string[] }
Output: { confirmed: boolean, meetingId: string }

## assign_task (Person C)
Input: { taskDescription: string, urgency: "low"|"medium"|"high" }
Output: { assignedOwner: string, deadline: string, priority: string }

## get_task_board (Person C)
Input: {}
Output: { tasks: [{ id: string, owner: string, status: string, deadline: string }] }

## check_admin_request (Admin agent, optional for demo)
Input: { requestDetails: string }
Output: { decision: "approved"|"escalated"|"rejected", reasoning: string }

## draft_message (Person D)
Input: { summary: string, channel: string }
Output: { messageText: string }

## post_to_slack / post_to_discord (Person D)
Input: { messageText: string, channel: string }
Output: { posted: boolean, messageUrl?: string }

## MCP Resources (read-only, shared shapes)

### roster://team (used by Person C)
{ members: [{ name: string, role: string, skills: string[], currentWorkload: number }] }

### calendar://availability (used by Person B)
{ [personName: string]: { busy: [{ start: string, end: string }], workingHours: { start: string, end: string } } }

### policy://admin-rules (used by Admin agent)
{ expenseLimit: number, approvalThresholds: [{ type: string, autoApproveUnder: number }] }

### tasks://board (used by Person C, delegation memory)
{ tasks: [{ id: string, owner: string, status: string, deadline: string }] }

### channels://directory (used by Person D)
{ [topic: string]: string }

## handle_request (Router, Person A — entry point, demo-safe one-call path)
Input: { requestText: string }
Output: {
  taskBreakdown: [{ subtask: string, assignedSpecialist: string }],
  specialistResults: object,
  summary: string
}