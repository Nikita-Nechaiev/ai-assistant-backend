import { IsEnum, IsOptional, IsDate, IsEmail, IsString } from 'class-validator';
import { InvitationStatus, NotificationStatus } from '../invitation.model';

export class UpdateInvitationDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsEnum(InvitationStatus)
  invitationStatus?: InvitationStatus;

  @IsOptional()
  @IsEnum(NotificationStatus)
  notificationStatus?: NotificationStatus;

  @IsOptional()
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsEmail()
  inviterEmail?: string;
}
