import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UsersService } from './users.service';
import { WalletAccountsService } from './wallet-accounts.service';
import { TransactionsService } from './transactions.service';

@Global()
@Module({
  providers: [
    PrismaService,
    UsersService,
    WalletAccountsService,
    TransactionsService,
  ],
  exports: [
    PrismaService,
    UsersService,
    WalletAccountsService,
    TransactionsService,
  ],
})
export class DatabaseModule {}
