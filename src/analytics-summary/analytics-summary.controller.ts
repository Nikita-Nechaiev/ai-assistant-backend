import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AnalyticsSummaryService } from './analytics-summary.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AnalyticsSummary } from './analytics-summary.model';

@Controller('analytics')
export class AnalyticsSummaryController {
  constructor(
    private readonly analyticsSummaryService: AnalyticsSummaryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAnalytics(@Req() req) {
    const userId = req.user.sub; // Extract user ID from JWT payload
    return this.analyticsSummaryService.getUserAnalytics(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateAnalytics(
    @Req() req,
    @Body() updates: Partial<AnalyticsSummary>,
  ) {
    const userId = req.user.sub; // Get user ID from JWT payload
    return this.analyticsSummaryService.updateAnalytics(userId, updates);
  }
}
