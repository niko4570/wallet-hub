import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getPortfolio() {
    return this.walletsService.getAggregatedPortfolio();
  }

  @Get(':address')
  getWallet(@Param('address') address: string) {
    return this.walletsService.getWallet(address);
  }

  @Post('link')
  linkWallet(@Body() dto: LinkWalletDto) {
    return this.walletsService.linkWallet(dto);
  }
}
