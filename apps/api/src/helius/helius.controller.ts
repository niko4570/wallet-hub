import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { HeliusService } from './helius.service';

@Controller('helius')
export class HeliusController {
  constructor(private readonly heliusService: HeliusService) {}

  @Post('webhook')
  async handleWebhook(
    @Body() payload: any[],
    @Headers('x-helius-signature') signature?: string,
  ) {
    await this.heliusService.processWebhook(payload, signature);
    return { received: payload?.length ?? 0 };
  }

  @Post('accounts/:address/track')
  async trackAddress(@Param('address') address: string) {
    const snapshot = await this.heliusService.registerAddress(address);
    return { address, snapshot };
  }

  @Get('accounts/:address/snapshot')
  getAccountSnapshot(@Param('address') address: string) {
    return this.heliusService.getAccountSnapshot(address);
  }

  @Get('accounts/:address/activity')
  getAccountActivity(@Param('address') address: string) {
    return this.heliusService.getActivity(address);
  }
}
