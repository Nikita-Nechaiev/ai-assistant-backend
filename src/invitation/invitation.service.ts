import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Invitation,
  InvitationStatus,
  NotificationStatus,
} from './invitation.model';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';

@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
  ) {}

  /**
   * Create a new invitation
   */
  async create(createInvitationDto: CreateInvitationDto): Promise<Invitation> {
    const invitation = this.invitationRepository.create(createInvitationDto);
    return await this.invitationRepository.save(invitation);
  }

  /**
   * Update an invitation
   */
  async update(
    id: number,
    updateInvitationDto: UpdateInvitationDto,
  ): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with id ${id} not found`);
    }

    Object.assign(invitation, updateInvitationDto);
    await this.invitationRepository.save(invitation);

    // Fetch the updated entity with relations
    return await this.invitationRepository.findOne({
      where: { id },
      relations: ['session'],
    });
  }

  /**
   * Delete an invitation
   */
  async delete(id: number): Promise<void> {
    const result = await this.invitationRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Invitation with id ${id} not found`);
    }
  }

  /**
   * Find all invitations
   */
  async findAll(): Promise<Invitation[]> {
    return await this.invitationRepository.find({
      relations: ['receiver', 'session'], // Include related entities
    });
  }

  /**
   * Find an invitation by ID
   */
  async findById(id: number): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
      relations: ['receiver', 'session'],
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with id ${id} not found`);
    }

    return invitation;
  }

  /**
   * Find all invitations for a specific user
   */
  async findByReceiverId(receiverId: number): Promise<Invitation[]> {
    return await this.invitationRepository.find({
      where: { receiver: { id: receiverId } },
      relations: ['session', 'receiver'], // Include related entities
      order: { date: 'DESC' }, // Sort by latest first
    });
  }

  async acceptInvitation(invitationId: number): Promise<Invitation> {
    const invitation = await this.findById(invitationId);

    if (invitation.invitationStatus !== InvitationStatus.PENDING) {
      throw new ForbiddenException(
        `Invitation with id ${invitationId} cannot be accepted. Current status: ${invitation.invitationStatus}`,
      );
    }

    // Update invitation status
    invitation.invitationStatus = InvitationStatus.ACCEPTED;
    invitation.notificationStatus = NotificationStatus.READ;

    // Determine permissions based on the role in the invitation
    const permissions =
      invitation.role === Permission.EDIT
        ? [Permission.READ, Permission.EDIT]
        : [Permission.READ];

    // Use the UserCollaborationSessionService to create a session
    await this.userCollaborationSessionService.createSession(
      invitation.receiver.id,
      invitation.session.id,
      permissions,
    );

    // Save the updated invitation
    return await this.invitationRepository.save(invitation);
  }

  async getInvitationsForSession(sessionId: number): Promise<Invitation[]> {
    return await this.invitationRepository.find({
      where: { session: { id: sessionId } },
      relations: ['receiver'], // Include related entities
      order: { date: 'DESC' }, // Optional: Sort by creation date
    });
  }

  async findByReceiverAndSession(
    receiverId: number,
    sessionId: number,
  ): Promise<Invitation | null> {
    return await this.invitationRepository.findOne({
      where: { receiver: { id: receiverId }, session: { id: sessionId } },
    });
  }

  async changeInvitationRole(
    invitationId: number,
    newRole: Permission,
  ): Promise<Invitation> {
    // Ensure the new role is either READ or EDIT
    if (![Permission.READ, Permission.EDIT].includes(newRole)) {
      throw new ForbiddenException(
        `Role can only be changed to ${Permission.READ} or ${Permission.EDIT}`,
      );
    }

    // Find the invitation
    const invitation = await this.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with id ${invitationId} not found`,
      );
    }

    // Update the role
    invitation.role = newRole;

    // Save the updated invitation
    return await this.invitationRepository.save(invitation);
  }
}
