import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import { AuditService } from '../../services/audit.service.js';
import * as fs from 'fs';
import * as path from 'path';

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

  private loadJsonFile(filename: string): any {
    try {
      const filePath = path.join(process.cwd(), 'src', 'resources', filename);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch {
      // ignore
    }
    return null;
  }

  @Resource({
    uri: 'config://policy',
    name: 'Enterprise Policy',
    description: 'Enterprise policy rules for communication, delegation, expenses, and system configurations.',
    mimeType: 'application/json'
  })
  async getPolicy(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Fetching enterprise policy');
    const policy = this.loadJsonFile('policy.json') || {};
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(policy, null, 2) }]
    };
  }

  @Resource({
    uri: 'config://channels',
    name: 'Notification Channels',
    description: 'Configuration mapping internal events to communication channels (e.g. Slack, Discord).',
    mimeType: 'application/json'
  })
  async getChannels(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Fetching channels config');
    const channels = this.loadJsonFile('channels.json') || {};
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(channels, null, 2) }]
    };
  }
}
