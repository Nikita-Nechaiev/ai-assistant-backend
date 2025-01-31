import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { User } from 'src/user/user.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  role: Permission;

  @ManyToOne(() => CollaborationSession, (session) => session.invitations, {
    onDelete: 'CASCADE',
  })
  session: CollaborationSession; // Ссылка на сессию

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  invitationStatus: InvitationStatus;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  notificationStatus: NotificationStatus;

  @CreateDateColumn()
  date: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null; // Срок действия приглашения (например, 7 дней)

  @Column({ type: 'varchar', length: 255, nullable: true })
  inviterEmail: string;

  @ManyToOne(() => User, (user) => user.invitations, { onDelete: 'CASCADE' })
  receiver: User;
}
