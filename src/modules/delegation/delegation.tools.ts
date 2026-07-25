import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import * as fs from 'fs';
import * as path from 'path';

export class DelegationTools {

    @Tool({
        name: 'assign_task',
        description: 'Assign a task to the most suitable team member.',
        inputSchema: z.object({
            taskDescription: z.string().describe('Description of the task'),
            urgency: z.enum(['low', 'medium', 'high'])
        })
    })
    async assignTask(input: any, ctx: ExecutionContext) {
        ctx.logger.info('Assigning task (Skill-Aware)', {
            task: input.taskDescription,
            urgency: input.urgency
        });

        // Read team roster
        const rosterPath = path.join(process.cwd(), 'src', 'resources', 'roster.json');
        const rosterFile = fs.readFileSync(rosterPath, 'utf-8');
        const roster = JSON.parse(rosterFile);

        const taskDesc = input.taskDescription.toLowerCase();

        // 1. Filter candidate pool based on urgency
        let candidatePool = roster.members;
        if (input.urgency === 'high') {
            const availableMembers = roster.members.filter((m: any) => m.currentWorkload < 3);
            if (availableMembers.length > 0) {
                candidatePool = availableMembers;
            }
        }

        // 2. Score candidates using the exact weighted formula and robust synonym mapping
        const skillMap: Record<string, string[]> = {
            react: ["react", "frontend", "ui", "dashboard"],
            backend: ["backend", "api", "server", "database"],
            aws: ["aws", "docker", "deployment", "cloud", "kubernetes"],
            testing: ["test", "qa", "automation"]
        };

        const maxWorkload = 5;
        const scoredMembers = candidatePool.map((member: any) => {
            // Pad description to ensure exact word matches (prevents "ui" matching "build")
            const paddedDesc = ` ${taskDesc.replace(/[^a-z0-9+-]/g, ' ')} `;
            
            const matchedSkills = member.skills.filter((skill: string) => {
                const normalizedSkill = skill.toLowerCase();
                if (paddedDesc.includes(` ${normalizedSkill} `)) return true;

                // Also check if any known synonyms for this skill appear in the description
                const synonyms = skillMap[normalizedSkill] || [];
                return synonyms.some(syn => paddedDesc.includes(` ${syn} `));
            });
            
            const skillMatchScore = matchedSkills.length * 10; 
            const availability = Math.max(0, maxWorkload - member.currentWorkload);
            
            // Overall Score = Skill Match × 60% + Availability × 30% - Current Workload × 10%
            const overallScore = (skillMatchScore * 0.6) + (availability * 0.3) - (member.currentWorkload * 0.1);

            return {
                ...member,
                matchedSkills,
                skillScore: matchedSkills.length,
                overallScore
            };
        });

        // 3. Sort by overall score (highest wins)
        scoredMembers.sort((a: any, b: any) => b.overallScore - a.overallScore);
        const bestMember = scoredMembers[0];

        // 4. Generate the exact reasoning string expected
        let reason = '';
        if (bestMember.skillScore > 0) {
            let skillsStr = bestMember.matchedSkills[0];
            if (bestMember.matchedSkills.length > 1) {
                const allButLast = bestMember.matchedSkills.slice(0, -1);
                const last = bestMember.matchedSkills[bestMember.matchedSkills.length - 1];
                skillsStr = `${allButLast.join(', ')} and ${last}`;
            }

            reason = `${bestMember.name} was selected because the task requires ${skillsStr} expertise, has the highest skill match, and currently has only ${bestMember.currentWorkload} active tasks.`;
        } else {
            reason = `${bestMember.name} was selected due to having the highest availability (only ${bestMember.currentWorkload} active tasks), as no specific skill match was found.`;
        }
        
        if (input.urgency === 'high' && roster.members.length !== candidatePool.length) {
            reason += ' Busier members were excluded due to the high urgency of this task.';
        }

        // 5. Decide deadline based on urgency
        let deadline = new Date();
        if (input.urgency === "high") {
            deadline.setDate(deadline.getDate() + 1);
        } else if (input.urgency === "medium") {
            deadline.setDate(deadline.getDate() + 3);
        } else {
            deadline.setDate(deadline.getDate() + 7);
        }

        const assignment = {
            assignedOwner: bestMember.name,
            deadline: deadline.toISOString().split("T")[0],
            priority: input.urgency,
            reason: reason
        };

        // 6. Update roster.json (increment workload)
        const memberIndex = roster.members.findIndex((m: any) => m.name === bestMember.name);
        if (memberIndex !== -1) {
            roster.members[memberIndex].currentWorkload += 1;
            fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 4));
        }

        // 7. Update tasks.json (add new task)
        const tasksPath = path.join(process.cwd(), 'src', 'resources', 'tasks.json');
        let tasksData = { tasks: [] as any[] };
        if (fs.existsSync(tasksPath)) {
            tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
        }

        const newTaskId = `TASK-${String(tasksData.tasks.length + 1).padStart(3, '0')}`;
        const newTask = {
            id: newTaskId,
            owner: bestMember.name,
            status: "Pending",
            deadline: assignment.deadline
        };
        tasksData.tasks.push(newTask);
        fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 4));

        // Include the generated taskId in the return object
        const finalAssignment = {
            ...assignment,
            taskId: newTaskId
        };

        ctx.logger.info('Assignment decision made and tasks updated', finalAssignment);

        return finalAssignment;
    }


    @Tool({
        name: 'get_task_board',
        description: 'Retrieve all current tasks.',
        inputSchema: z.object({})
    })
    async getTaskBoard(input: any, ctx: ExecutionContext) {
        ctx.logger.info('Fetching task board');

        const tasksPath = path.join(process.cwd(), 'src', 'resources', 'tasks.json');

        const file = fs.readFileSync(tasksPath, 'utf-8');

        const tasks = JSON.parse(file);

        return tasks;
    }


}