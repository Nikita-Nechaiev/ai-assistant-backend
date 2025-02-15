import { Entity, ManyToOne, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { User } from 'src/user/user.model';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';

export enum Permission {
  READ = 'read',
  EDIT = 'edit',
  ADMIN = 'admin',
}

@Entity('user_collaboration_sessions')
export class UserCollaborationSession {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userCollaborationSessions, {
    onDelete: 'CASCADE',
  })
  user: User;

  @ManyToOne(
    () => CollaborationSession,
    (session) => session.userCollaborationSessions,
    {
      onDelete: 'CASCADE',
    },
  )
  session: CollaborationSession;

  @Column({
    type: 'simple-array',
    default: Permission.READ,
  })
  permissions: Permission[];

  @Column({ type: 'bigint', default: 0 })
  timeSpent: number;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  lastInteracted: Date;
}
