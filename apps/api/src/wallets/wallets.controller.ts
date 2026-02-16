import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { HeliusService } from '../helius/helius.service';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly heliusService: HeliusService,
  ) {}

  @Get()
  getPortfolio() {
    return this.walletsService.getAggregatedPortfolio();
  }

  @Get(':address')
  getWallet(@Param('address') address: string) {
    return this.walletsService.getWallet(address);
  }



  @Get(':address/activity')
  getActivity(@Param('address') address: string) {
    return this.heliusService.getActivity(address);
  }

  @Post('link')
  linkWallet(@Body() dto: LinkWalletDto) {
    return this.walletsService.linkWallet(dto);
  }
}
