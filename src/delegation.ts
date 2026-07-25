import { Request, TaskAssignment } from "./types.js";
import roster from "./resources/roster.json" with { type: 'json' };

export async function handleDelegation(req: Request): Promise<TaskAssignment> {
  const text = req.text.toLowerCase();
  
  let chosenOwner = "unassigned";
  let reasoning = "Could not determine the appropriate owner based on skills.";
  let lowestWorkload = Infinity;

  // 1. Determine Owner based on matching skills in roster
  for (const member of roster.members) {
    const hasSkillMatch = member.skills.some((skill: string) => text.includes(skill.toLowerCase()));
    
    if (hasSkillMatch) {
      // If multiple people match the skills, pick the one with the lowest workload
      if (member.currentWorkload < lowestWorkload) {
        chosenOwner = member.name.toLowerCase();
        lowestWorkload = member.currentWorkload;
        reasoning = `Assigned to ${chosenOwner} based on matching skills in roster and lowest current workload (${lowestWorkload}).`;
      }
    }
  }

  // Fallback if no skills match: assign to whoever has the absolute lowest workload on the team
  if (chosenOwner === "unassigned") {
    let fallbackMember = roster.members[0];
    for (const member of roster.members) {
      if (member.currentWorkload < fallbackMember.currentWorkload) {
        fallbackMember = member;
      }
    }
    chosenOwner = fallbackMember.name.toLowerCase();
    reasoning = `No skill match found. Assigned to ${chosenOwner} as they have the lowest overall workload on the roster (${fallbackMember.currentWorkload}).`;
  }

  // 2. Determine Priority
  let priority: "low" | "medium" | "high" = "medium";
  if (["asap", "urgent", "critical", "blocker", "emergency", "immediately"].some(kw => text.includes(kw))) {
    priority = "high";
  } else if (["when possible", "backlog", "low priority", "later", "no rush"].some(kw => text.includes(kw))) {
    priority = "low";
  }

  // 3. Determine Deadline based on priority
  const daysToAdd = priority === "high" ? 1 : priority === "medium" ? 3 : 7;
  const deadlineDate = new Date();
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() + daysToAdd);

  return {
    taskId: `task-${Date.now()}`,
    owner: chosenOwner,
    deadline: deadlineDate.toISOString(),
    priority,
    reasoning
  };
}
