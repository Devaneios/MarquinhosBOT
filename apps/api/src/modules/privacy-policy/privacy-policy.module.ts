import { Module } from '@nestjs/common';
import { PrivacyPolicyController } from 'modules/privacy-policy/privacy-policy.controller';

@Module({ controllers: [PrivacyPolicyController] })
export class PrivacyPolicyModule {}
