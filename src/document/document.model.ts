import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';
import { Version } from 'src/version/version.model';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  richContent: string;

  @CreateDateColumn()
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => CollaborationSession, (session) => session.documents, {
    onDelete: 'CASCADE',
  })
  collaborationSession: CollaborationSession;

  @OneToMany(() => AiToolUsage, (aiToolUsage) => aiToolUsage.document)
  aiToolUsages: AiToolUsage[];

  @OneToMany(() => Version, (version) => version.document)
  versions: Version[];
}
