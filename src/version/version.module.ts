import { Module } from '@nestjs/common';
import { VersionService } from './version.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Version } from './version.model';

@Module({
  imports: [TypeOrmModule.forFeature([Version])],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
