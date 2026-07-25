import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import { AuditService } from '../../services/audit.service.js';

/**
 * Exposes the audit log data as an MCP resource at `audit://logs`.
 */
export class AdminResources {
  @Resource({
    uri: 'audit://logs',
    name: 'Audit Logs',
    description: 'The complete system audit log, including tool calls, routing decisions, and execution metrics.',
    mimeType: 'application/json'
  })
  async getAuditLogs(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Fetching audit logs');

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(AuditService.readLogs(), null, 2),
        },
      ],
    };
  }
}
