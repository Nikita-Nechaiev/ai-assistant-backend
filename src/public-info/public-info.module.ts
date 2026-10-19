import { Module } from '@nestjs/common';

import { PublicInfoController } from './public-info.controller';
import { PublicInfoService } from './public-info.service';

@Module({
  controllers: [PublicInfoController],
  providers: [PublicInfoService],
})
export class PublicInfoModule {}
