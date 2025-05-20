import { Document } from 'src/document/document.model';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';

@Entity('versions')
export class Version {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Document, (document) => document.versions, {
    onDelete: 'CASCADE',
  })
  document: Document;

  @Column()
  richContent: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  userEmail: string;
}
