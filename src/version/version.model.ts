import { Document } from 'src/document/document.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity('versions')
export class Version {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Document, (document) => document.versions, {
    onDelete: 'CASCADE',
  })
  document: Document;

  @Column('text')
  content: string;

  @Column('json', { nullable: true })
  richContent: object | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: object | null;
}
