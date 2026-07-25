# CONTRACTS.md

## find_meeting_slot (Person B)
Input: { attendees: string[], durationMinutes: number, urgency: "low"|"medium"|"high" }
Output: { proposedSlots: string[], conflicts: string[], reasoning: string }

## assign_task (Person C)
Input: { taskDescription: string, urgency: "low"|"medium"|"high" }
Output: { assignedOwner: string, deadline: string, priority: string }

## check_admin_request (Admin agent, optional for demo)
Input: { requestDetails: string }
Output: { decision: "approved"|"escalated"|"rejected", reasoning: string }

## draft_message / post_to_slack / post_to_discord (Person D)
Input: { summary: string, channel: string }
Output: { posted: boolean, messageUrl?: string }