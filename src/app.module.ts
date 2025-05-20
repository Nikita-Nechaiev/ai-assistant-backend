import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './user/users.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { AiToolUsageModule } from './ai-tool-usage/ai-tool-usage.module';
import { CollaborationSessionModule } from './collaboration-session/collaboration-session.module';
import { EmailModule } from './email/email.module';
import { UserCollaborationSessionModule } from './user-collaboration-session/user-collaboration-session.module';
import { InvitationModule } from './invitation/invitation.module';
import { MessagesModule } from './messages/messages.module';
import { TokenModule } from './token/token.module';
import { FileModule } from './file/file.module';

@Module({
  controllers: [],
  providers: [],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'development' ? '.development.env' : undefined,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || undefined, // Используем DATABASE_URL, если она задана
      host: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_HOST,
      port: process.env.DATABASE_URL ? undefined : Number(process.env.POSTGRES_PORT),
      username: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_USER,
      password: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_PASSWORD,
      database: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    DocumentModule,
    AiToolUsageModule,
    CollaborationSessionModule,
    EmailModule,
    UserCollaborationSessionModule,
    InvitationModule,
    MessagesModule,
    TokenModule,
    FileModule,
  ],
})
export class AppModule {}
