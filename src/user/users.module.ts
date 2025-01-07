import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.model';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsSummaryModule } from 'src/analytics-summary/analytics-summary.module';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [
    AnalyticsSummaryModule,
    SettingsModule,
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
