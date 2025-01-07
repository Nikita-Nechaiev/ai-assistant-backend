import { Controller, Post, Get, Put, Body, Param } from '@nestjs/common';
import { CollaborationSessionService } from './collaboration-session.service';

@Controller('collaboration-session')
export class CollaborationSessionController {
  constructor(
    private readonly collaborationSessionService: CollaborationSessionService,
  ) {}

  @Post('create')
  async createSession(
    @Body('userId') userId: number,
    @Body('name') name?: string,
  ) {
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
