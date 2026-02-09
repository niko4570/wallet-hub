import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { BiometricVerificationService } from '../security/biometric-verification.service';
import { MpcSignerService } from '../security/mpc-signer.service';

@Module({
  controllers: [SessionController],
  providers: [SessionService, BiometricVerificationService, MpcSignerService],
  exports: [SessionService],
})
export class SessionModule {}
