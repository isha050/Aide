import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import roster from '../../resources/roster.json';

/**
 * Exposes the team roster data as an MCP resource at `roster://team`.
 */
export class DelegationResources {
  @Resource({
    uri: 'roster://team',
    name: 'Team Roster',
    description: 'The complete employee roster, including names, emails, roles, skills, and current workloads.',
    mimeType: 'application/json'
  })
  async getRoster(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Fetching team roster');

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(roster, null, 2),
        },
      ],
    };
  }
}
