import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation, InvitationStatus } from './invitation.model';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';

@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
  ) {}

  async createInvitation(
    sessionId: number,
    email: string,
    role: string,
    inviter: string,
    expiresAt?: Date,
  ): Promise<Invitation> {

    if (!sessionId) {
      throw new Error('Collaboration session not found');
    }

    const invitation = this.invitationRepository.create({
      session: {id: sessionId},
      email,
      role,
      inviter,
      expiresAt: expiresAt || null,
    });

    return this.invitationRepository.save(invitation);
  }

  async updateInvitationStatus(
    id: number,
    status: InvitationStatus,
  ): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    invitation.status = status;
    return this.invitationRepository.save(invitation);
  }
}
