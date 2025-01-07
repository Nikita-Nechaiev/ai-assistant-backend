import { Controller, Post, Put, Body, Param } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationStatus } from './invitation.model';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('create')
  async createInvitation(
    @Body('sessionId') sessionId: number,
    @Body('email') email: string,
    @Body('role') role: string,
    @Body('inviter') inviter: string,
    @Body('expiresAt') expiresAt?: Date,
  ) {
    return this.invitationService.createInvitation(
      sessionId,
      email,
      role,
      inviter,
      expiresAt,
    );
  }

  @Put(':id/status')
  async updateInvitationStatus(
    @Param('id') id: number,
    @Body('status') status: InvitationStatus,
  ) {
    return this.invitationService.updateInvitationStatus(id, status);
  }
}
