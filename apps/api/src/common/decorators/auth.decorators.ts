import { applyDecorators, UseGuards } from '@nestjs/common';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { GuildMemberGuard } from 'common/guards/guild-member.guard';
import { SharedBucketThrottlerGuard } from 'common/guards/shared-bucket-throttler.guard';

export const BotAuth = () => applyDecorators(UseGuards(BotAuthGuard));

export const ActivityAuth = () => applyDecorators(UseGuards(ActivityAuthGuard));

export const ActivityGuildMember = () =>
  applyDecorators(UseGuards(ActivityAuthGuard, GuildMemberGuard));

export const ActivityRateLimit = () =>
  applyDecorators(UseGuards(SharedBucketThrottlerGuard));
