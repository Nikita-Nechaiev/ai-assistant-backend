import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserCollaborationSessionService } from './user-collaboration-session.service';
import { Permission } from './user-collaboration-session.model';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('user-collaboration-session')
export class UserCollaborationSessionController {
  constructor(
    private readonly userCollabSessionService: UserCollaborationSessionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('user-sessions')
  async getUserCollaborationSessions(@Req() req) {
    const userId = req.user.id;
    return this.userCollabSessionService.getUserCollaborationSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createSession(
    @Req() req,
    @Body('sessionId') sessionId: number,
    @Body('permissions') permissions: Permission[],
  ) {
    const userId = req.user.id;

    return this.userCollabSessionService.createSession(
      userId,
      sessionId,
      permissions,
    );
  }

  @Put(':id/time-spent')
  async updateTimeSpent(
    @Param('id') id: number,
    @Body('timeSpent') timeSpent: number,
  ) {
    return this.userCollabSessionService.updateTimeSpent(id, timeSpent);
  }

  @Put(':id/permissions')
  async updatePermissions(
    @Param('id') id: number,
    @Body('permissions') permissions: Permission[],
  ) {
    return this.userCollabSessionService.updatePermissions(id, permissions);
  }

  @Delete(':id')
  async deleteSession(@Param('id') id: number) {
    return this.userCollabSessionService.deleteSession(id);
  }
}
