import { Document } from 'src/document/document.model';
import { Invitation } from 'src/invitation/invitation.model';
import { Message } from 'src/messages/messages.model';
import { UserCollaborationSession } from 'src/user-collaboration-session/user-collaboration-session.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  Column,
} from 'typeorm';

@Entity('collaboration_sessions')
export class CollaborationSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => Document, (document) => document.collaborationSession, {
    cascade: true,
  })
  documents: Document[];

  @OneToMany(
    () => UserCollaborationSession,
    (userSession) => userSession.session,
  )
  userCollaborationSessions: UserCollaborationSession[];

  @OneToMany(() => Invitation, (invitation) => invitation.session, {
    cascade: true,
  })
  invitations: Invitation[];

  @OneToMany(() => Message, (message) => message.collaborationSession, {
    cascade: true,
  })
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;
}
