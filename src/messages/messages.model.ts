import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
import { User } from 'src/user/user.model';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  text: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  sender: User;

  @ManyToOne(() => CollaborationSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  collaborationSession: CollaborationSession;

  @CreateDateColumn()
  createdAt: Date;
}
