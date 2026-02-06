import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IssueSessionKeyDto } from './dto/issue-session-key.dto';
import { RevokeSessionKeyDto } from './dto/revoke-session-key.dto';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  listSessionKeys() {
    return this.sessionService.listSessionKeys();
  }

  @Get('policies')
  listPolicies() {
    return this.sessionService.listPolicies();
  }

  @Post('issue')
  issueSessionKey(@Body() dto: IssueSessionKeyDto) {
    return this.sessionService.issueSessionKey(dto);
  }

  @Patch(':id/revoke')
  revokeSessionKey(@Param('id') id: string, @Body() dto: RevokeSessionKeyDto) {
    return this.sessionService.revokeSessionKey(id, dto);
  }

  @Delete(':id')
  deleteSessionKey(@Param('id') id: string) {
    return this.sessionService.revokeSessionKey(id, { reason: 'api_delete' });
  }
}
