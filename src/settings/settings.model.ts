import { User } from 'src/user/user.model';
import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';

export enum Theme {
  SYSTEM = 'system',
  LIGHT = 'light',
  DARK = 'dark',
}

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: true })
  autoSave: boolean;

  @Column({ default: true })
  soundNotifications: boolean;

  @Column({ type: 'enum', enum: Theme, default: Theme.SYSTEM })
  theme: Theme;

  @Column({ default: true })
  animatedInput: boolean;

  @Column({ type: 'varchar', default: 'Times New Roman' })
  preferredFont: string;

  @Column({ default: 18 })
  fontSize: number;

  @Column({ default: 500 })
  fontWeight: number;

  @OneToOne(() => User, (user) => user.settings, {
    onDelete: 'CASCADE',
  })
  user: User;
}
