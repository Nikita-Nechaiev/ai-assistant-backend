import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './user/users.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { AiToolUsageModule } from './ai-tool-usage/ai-tool-usage.module';
import { AnalyticsSummaryModule } from './analytics-summary/analytics-summary.module';
import { CollaborationSessionModule } from './collaboration-session/collaboration-session.module';
import { EmailModule } from './email/email.module';
import { UserCollaborationSessionModule } from './user-collaboration-session/user-collaboration-session.module';
import { SettingsModule } from './settings/settings.module';
import { InvitationModule } from './invitation/invitation.module';
import { MessagesModule } from './messages/messages.module';
import { TokenModule } from './token/token.module';

@Module({
  controllers: [],
  providers: [],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    DocumentModule,
    AiToolUsageModule,
    AnalyticsSummaryModule,
    CollaborationSessionModule,
    EmailModule,
    UserCollaborationSessionModule,
    SettingsModule,
    InvitationModule,
    MessagesModule,
    TokenModule,
  ],
})
export class AppModule {}
