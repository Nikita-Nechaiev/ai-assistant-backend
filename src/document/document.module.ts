import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.model';
import { VersionModule } from 'src/version/version.module';
import { AiToolUsageModule } from 'src/ai-tool-usage/ai-tool-usage.module';
import { DocumentGateway } from './document.gateway';
import { UsersModule } from 'src/user/users.module';
import { CollaborationSessionModule } from 'src/collaboration-session/collaboration-session.module';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { AiToolFacadeService } from './utils/ai-tool-facade.service';

@Module({
  imports: [
    VersionModule,
    AiToolUsageModule,
    UsersModule,
    CollaborationSessionModule,
    TypeOrmModule.forFeature([Document]),
  ],
  providers: [DocumentService, DocumentGateway, SessionContextService, AiToolFacadeService],
  exports: [DocumentService],
})
export class DocumentModule {}
