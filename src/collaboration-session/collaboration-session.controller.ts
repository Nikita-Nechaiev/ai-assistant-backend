import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { CollaborationSessionService } from './collaboration-session.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('collaboration-session')
export class CollaborationSessionController {
  constructor(
    private readonly collaborationSessionService: CollaborationSessionService,
  ) {}

  @Get('get-user-sessions')
  async getUserSessions(
    @Req() req: Request,
    @Query('page') page: string = '1',
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID is missing in the request');
    }

    const parsedPage = parseInt(page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }

    const take = 25;
    const skip = (parsedPage - 1) * take;

    return this.collaborationSessionService.getUserSessions(userId, skip, take);
  }

  @Post('create')
  async createSession(@Req() req: Request, @Body('name') name: string) {
    const userId = req.user.id;
    return this.collaborationSessionService.createSession(userId, name);
  }

  @Get(':id')
  async getSession(@Param('id') id: number) {
    return this.collaborationSessionService.getSession(id);
  }

  @Put(':id')
  async updateSessionName(@Param('id') id: number, @Body('name') name: string) {
    return this.collaborationSessionService.updateSessionName(id, name);
  }
}
