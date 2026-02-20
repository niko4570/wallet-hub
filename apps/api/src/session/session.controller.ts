import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IssueSessionKeyDto } from './dto/issue-session-key.dto';
import { RevokeSessionKeyDto } from './dto/revoke-session-key.dto';
import { SessionService } from './session.service';
import { RecordSilentReauthorizationDto } from './dto/record-silent-reauthorization.dto';
import { SilentReauthorizationService } from './silent-reauthorization.service';
import { RecordTransactionAuditDto } from './dto/record-transaction-audit.dto';
import { TransactionAuditService } from './transaction-audit.service';
import { SessionSecurityGuard } from '../security/session-security.guard';

@Controller('session')
@UseGuards(SessionSecurityGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly silentReauthService: SilentReauthorizationService,
    private readonly transactionAuditService: TransactionAuditService,
  ) {}

  @Get()
  async listSessionKeys() {
    return await this.sessionService.listSessionKeys();
  }

  @Get('status')
  getSessionSettings() {
    return this.sessionService.getSettings();
  }

  @Get('policies')
  async listPolicies() {
    return await this.sessionService.listPolicies();
  }

  @Post('issue')
  async issueSessionKey(@Body() dto: IssueSessionKeyDto) {
    return await this.sessionService.issueSessionKey(dto);
  }

  @Patch(':id/revoke')
  async revokeSessionKey(
    @Param('id') id: string,
    @Body() dto: RevokeSessionKeyDto,
  ) {
    return await this.sessionService.revokeSessionKey(id, dto);
  }

  @Delete(':id')
  async deleteSessionKey(@Param('id') id: string) {
    return await this.sessionService.revokeSessionKey(id, {
      reason: 'api_delete',
    });
  }

  @Get('silent')
  listSilentReauthorizations() {
    return this.silentReauthService.list();
  }

  @Post('silent')
  recordSilentReauthorization(@Body() dto: RecordSilentReauthorizationDto) {
    return this.silentReauthService.record(dto);
  }

  @Get('audits')
  listTransactionAudits() {
    return this.transactionAuditService.list();
  }

  @Post('audits')
  recordTransactionAudit(@Body() dto: RecordTransactionAuditDto) {
    return this.transactionAuditService.record(dto);
  }
}
