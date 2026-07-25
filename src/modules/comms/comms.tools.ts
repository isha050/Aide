import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import * as fs from 'fs';
import * as path from 'path';

export class CommsTools {
  @Tool({
    name: 'draft_message',
    description: 'Draft a message and determine its destination channel',
    inputSchema: z.object({
      action: z.string().describe('The action requiring a message'),
      details: z.string().describe('Details to include in the message')
    })
  })
  async draftMessage(input: any, ctx: ExecutionContext) {
    let channelsConfig: any = {};
    try {
      const channelsPath = path.join(process.cwd(), 'src', 'resources', 'channels.json');
      if (fs.existsSync(channelsPath)) {
        channelsConfig = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
      }
    } catch (e) {
      ctx.logger.error('Failed to read channels.json');
    }

    const { action, details } = input;

    const channel = channelsConfig[action]?.channel || 'default-channel';
    const format = channelsConfig[action]?.format || 'text';

    const text = `Draft for ${action}: ${details}`;

    return {
      text,
      channel,
      format
    };
  }
}
