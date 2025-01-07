import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';
import { AnalyticsSummary } from 'src/analytics-summary/analytics-summary.model';
import { Notification } from 'src/notifications/notification.model';
import { Settings } from 'src/settings/settings.model';
import { UserCollaborationSession } from 'src/user-collaboration-session/user-collaboration-session.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  oauthProvider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  oauthId: string;

  @Column({ type: 'simple-array', default: Role.USER })
  roles: Role[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'varchar', nullable: true })
  resetToken: string;

  @Column({ type: 'bigint', nullable: true })
  resetTokenExpires: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string; // URL или путь до аватарки пользователя

  @OneToMany(() => UserCollaborationSession, (userSession) => userSession.user)
  userCollaborationSessions: UserCollaborationSession[];

  @OneToMany(() => AiToolUsage, (aiToolUsage) => aiToolUsage.user)
  aiToolUsages: AiToolUsage[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToOne(() => Settings, (settings) => settings.user, { cascade: true })
  @JoinColumn()
  settings: Settings;

  @JoinColumn()
  @OneToOne(() => AnalyticsSummary, (analyticsSummary) => analyticsSummary.user)
  analyticsSummary: AnalyticsSummary;
}
