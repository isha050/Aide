import { Module } from '@nitrostack/core';
import { AdminTools } from './admin.tools.js';

@Module({
  name: 'admin',
  description: 'Admin requests module',
  controllers: [AdminTools]
})
export class AdminModule {}
