import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsEmail,
  IsDate,
  ValidateNested,
} from 'class-validator';
import { InvitationStatus, NotificationStatus } from '../invitation.model';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { User } from 'src/user/user.model';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';

export class CreateInvitationDto {
  @IsEnum(Permission)
  role: Permission;

  @ValidateNested()
  @Type(() => CollaborationSession)
  session: CollaborationSession;

  @IsEnum(InvitationStatus)
  @IsOptional()
  invitationStatus?: InvitationStatus;

  @IsEnum(NotificationStatus)
  @IsOptional()
  notificationStatus?: NotificationStatus;

  @IsDate()
  @IsOptional()
  expiresAt?: Date;

  @IsEmail()
  @IsOptional()
  inviterEmail?: string;

  @ValidateNested()
  @Type(() => User)
  receiver: User;
}
