import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import * as fs from 'fs';
import * as path from 'path';

export class DelegationResources {
    @Resource({
        uri: 'roster://team',
        name: 'Team Roster',
        description: 'Team members, roles, skills and workloads',
        mimeType: 'application/json'
    })
    async getRoster(uri: string, ctx: ExecutionContext) {
        ctx.logger.info('Fetching roster resource');
        const rosterPath = path.join(process.cwd(), 'src', 'resources', 'roster.json');
        const roster = fs.readFileSync(rosterPath, 'utf-8');

        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: roster
                }
            ]
        };
    }

    @Resource({
        uri: 'tasks://board',
        name: 'Task Board',
        description: 'Current delegated tasks',
        mimeType: 'application/json'
    })
    async getTasks(uri: string, ctx: ExecutionContext) {
        ctx.logger.info('Fetching tasks resource');
        const tasksPath = path.join(process.cwd(), 'src', 'resources', 'tasks.json');
        
        let tasks = JSON.stringify({ tasks: [] });
        if (fs.existsSync(tasksPath)) {
            tasks = fs.readFileSync(tasksPath, 'utf-8');
        }

        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: tasks
                }
            ]
        };
    }
}
