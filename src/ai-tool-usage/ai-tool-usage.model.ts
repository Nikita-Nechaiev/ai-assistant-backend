import { Document } from 'src/document/document.model';
import { User } from 'src/user/user.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

@Entity('ai_tool_usage')
export class AiToolUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  toolName: string;

  @Column()
  sentText: string;

  @Column()
  result: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, (user) => user.aiToolUsages, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Document, { onDelete: 'CASCADE', nullable: true })
  document: Document | null; // Allow null for optional association
}
