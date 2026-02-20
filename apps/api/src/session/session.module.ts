import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { BiometricVerificationService } from '../security/biometric-verification.service';
import { MpcSignerService } from '../security/mpc-signer.service';
import { SilentReauthorizationService } from './silent-reauthorization.service';
import { TransactionAuditService } from './transaction-audit.service';
import { InfrastructureConfigService } from '../config/infrastructure-config.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SessionController],
  providers: [
    SessionService,
    BiometricVerificationService,
    MpcSignerService,
    SilentReauthorizationService,
    TransactionAuditService,
    InfrastructureConfigService,
    PrismaService,
  ],
  exports: [SessionService],
})
export class SessionModule {}
