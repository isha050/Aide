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

        // Check for skill matches
        const matchedMembers = roster.members.filter((member: any) => {
            return member.skills.some((skill: string) => taskDesc.includes(skill.toLowerCase()));
        });

        // Decide candidate pool (matched or everyone)
        const candidates = matchedMembers.length > 0 ? matchedMembers : roster.members;

        // Find the member with the least workload in the candidate pool
        const bestMember = candidates.reduce((best: any, current: any) => {
            return current.currentWorkload < best.currentWorkload ? current : best;
        });

        // Generate reason
        let reason = '';
        if (matchedMembers.length > 0) {
            reason = `Selected ${bestMember.name} because the task matches their skills and they have the lowest workload among qualified specialists.`;
        } else {
            reason = `Selected ${bestMember.name} based on lowest overall workload as no specific skill match was found.`;
        }

        // Decide deadline
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

        ctx.logger.info('Assignment decision made', assignment);

        return assignment;
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