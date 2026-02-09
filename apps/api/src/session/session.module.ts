import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { BiometricVerificationService } from '../security/biometric-verification.service';

@Module({
  controllers: [SessionController],
  providers: [SessionService, BiometricVerificationService],
  exports: [SessionService],
})
export class SessionModule {}
