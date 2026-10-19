import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { PublicInfoController } from './public-info.controller';

describe('PublicInfoController', () => {
  it('streams a downloadable PDF with its actual length', async () => {
    const bytes = Buffer.from('%PDF-1.7 CV');
    const service = { getCv: jest.fn().mockResolvedValue(bytes) };
    const file = await new PublicInfoController(service as any).getCv();

    expect(file.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: 'attachment; filename="Mykyta-Nechaiev-CV.pdf"',
      length: bytes.length,
    });

    const chunks = [];

    for await (const chunk of file.getStream()) chunks.push(chunk);

    expect(Buffer.concat(chunks)).toEqual(bytes);
  });
  it('is public and disables stale cached downloads', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicInfoController)).toBeUndefined();
    expect(Reflect.getMetadata(HEADERS_METADATA, PublicInfoController.prototype.getCv)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-cache',
    });
  });
});
