import { Controller, Get, Header, StreamableFile } from '@nestjs/common';

import { PublicInfoService } from './public-info.service';

@Controller('public-info')
export class PublicInfoController {
  constructor(private readonly publicInfoService: PublicInfoService) {}

  @Get('cv')
  @Header('Cache-Control', 'no-cache')
  async getCv(): Promise<StreamableFile> {
    const file = await this.publicInfoService.getCv();

    return new StreamableFile(file, {
      type: 'application/pdf',
      disposition: 'attachment; filename="Mykyta-Nechaiev-CV.pdf"',
      length: file.length,
    });
  }
}
