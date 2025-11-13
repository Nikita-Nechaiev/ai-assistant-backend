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
import { HealthModule } from './health/health.module';

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
        const dbUrl = cfg.get<string>('DATABASE_URL');

        console.log('dbUrl', dbUrl);

        if (!dbUrl) {
          throw new Error('DATABASE_URL is not set');
        }

        const sslMode = (cfg.get<string>('DB_SSL_MODE') ?? 'auto').toLowerCase();
        const isLocalish = (url?: string) =>
          !!url && (/localhost/i.test(url) || /127\.0\.0\.1/.test(url) || /internal/i.test(url));
        const isNeedSSL = sslMode === 'require' || (sslMode === 'auto' && dbUrl && !isLocalish(dbUrl));
        const ssl = isNeedSSL ? { rejectUnauthorized: false } : false;

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: true,
          ssl,
          ...(isNeedSSL ? { extra: { ssl } } : {}),
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
    HealthModule,
  ],
})
export class AppModule {}
