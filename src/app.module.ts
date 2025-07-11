import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { UsersModule } from './user/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'development'
          ? '.development.env'
          : process.env.NODE_ENV === 'test'
            ? '.test.env'
            : '.production.env',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const isTest = cfg.get('NODE_ENV') === 'test';
        const dbUrl = cfg.get<string>('DATABASE_URL');

        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            autoLoadEntities: true,
            synchronize: true,
            ssl: dbUrl.includes('amazonaws.com') ? { rejectUnauthorized: false } : false,
          };
        }

        if (isTest) {
          return {
            type: 'postgres',
            host: cfg.get('PG_HOST') ?? 'localhost',
            port: Number(cfg.get('PG_PORT') ?? 5433),
            username: cfg.get('PG_USER') ?? 'test',
            password: cfg.get('PG_PASS') ?? 'test',
            database: cfg.get('PG_DB') ?? 'myapp_test',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
          };
        }

        return {
          type: 'postgres',
          host: cfg.get('POSTGRES_HOST') ?? 'localhost',
          port: Number(cfg.get('POSTGRES_PORT') ?? 5432),
          username: cfg.get('POSTGRES_USER') ?? 'postgres',
          password: cfg.get('POSTGRES_PASSWORD') ?? 'postgres',
          database: cfg.get('POSTGRES_DB') ?? 'myapp',
          autoLoadEntities: true,
          synchronize: true,
        };
      },
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
