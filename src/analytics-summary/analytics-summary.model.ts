import { User } from 'src/user/user.model';
import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';

@Entity('analytics_summary')
export class AnalyticsSummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  totalWordCount: number;

  @Column({ default: 0 })
  totalSessions: number;

  @Column({ default: 0 })
  totalDocuments: number;

  @Column({ nullable: true })
  mostUsedAiTool: string;

  @Column({ default: 0 })
  activeHours: number;

  @OneToOne(() => User, (user) => user.analyticsSummary, {
    onDelete: 'CASCADE',
  })
  user: User;
}
