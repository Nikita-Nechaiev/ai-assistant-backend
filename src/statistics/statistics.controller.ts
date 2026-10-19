import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/user.model';

import { DashboardStatisticsDto } from './dto/dashboard-statistics.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  getDashboard(@Req() request: Request & { user: User }): Promise<DashboardStatisticsDto> {
    return this.statisticsService.getDashboard(request.user.id);
  }
}
