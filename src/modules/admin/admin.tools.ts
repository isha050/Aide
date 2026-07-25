import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import * as fs from 'fs';
import * as path from 'path';

export class AdminTools {
  @Tool({
    name: 'check_admin_request',
    description: 'Check if an admin request is approved based on policy',
    inputSchema: z.object({
      requestType: z.string().describe('The type of admin request'),
      amount: z.number().optional().describe('The optional amount for the request'),
      details: z.string().describe('Details of the request')
    })
  })
  async checkAdminRequest(input: any, ctx: ExecutionContext) {
    let policy: any = {};
    try {
      const policyPath = path.join(process.cwd(), 'src', 'resources', 'policy.json');
      if (fs.existsSync(policyPath)) {
        policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
      }
    } catch (e) {
      ctx.logger.error('Failed to read policy.json');
    }

    const { requestType, amount, details } = input;

    let approved = false;
    let reason = 'Request denied by default policy';
    let escalationRequired = false;

    if (policy[requestType]) {
      const rule = policy[requestType];
      if (amount !== undefined && rule.maxAmount !== undefined) {
        if (amount <= rule.maxAmount) {
          approved = true;
          reason = `Amount ${amount} is within the allowed limit of ${rule.maxAmount}`;
        } else {
          escalationRequired = true;
          reason = `Amount ${amount} exceeds the allowed limit of ${rule.maxAmount}. Escalation required.`;
        }
      } else if (rule.allowed) {
        approved = true;
        reason = 'Request type is allowed by policy';
      }
    } else {
      escalationRequired = true;
      reason = `Unknown request type: ${requestType}. Escalation required.`;
    }

    return {
      approved,
      reason,
      escalationRequired
    };
  }
}
