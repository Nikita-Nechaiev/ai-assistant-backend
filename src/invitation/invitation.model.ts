import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
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
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @ManyToOne(() => CollaborationSession, (session) => session.invitations, {
    onDelete: 'CASCADE',
  })
  session: CollaborationSession; // Ссылка на сессию

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null; // Срок действия приглашения (например, 7 дней)

  @Column({ type: 'varchar', length: 255, nullable: true })
  inviter: string;
}
