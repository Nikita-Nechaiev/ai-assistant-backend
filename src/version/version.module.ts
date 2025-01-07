import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Version } from './version.model';

@Module({
  imports: [TypeOrmModule.forFeature([Version])],
  controllers: [VersionController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
