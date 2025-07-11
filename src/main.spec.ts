import { ValidationPipe } from '@nestjs/common';

const use = jest.fn();
const listen = jest.fn().mockResolvedValue(undefined);
const enableCors = jest.fn();

const create = jest.fn().mockResolvedValue({
  use,
  useGlobalPipes: jest.fn(),
  listen,
  enableCors,
});

jest.mock('@nestjs/core', () => ({ NestFactory: { create } }));

class MockAppModule {}

jest.mock('./app.module', () => ({ AppModule: MockAppModule }));

jest.mock('cookie-parser', () => () => 'cookie-parser');

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

process.env.PORT = '4444';
process.env.FRONTEND_URL = 'http://localhost:3000';

import('./main');

describe('main.ts bootstrap()', () => {
  it('creates app, wires middleware, enables CORS and starts listening', async () => {
    await Promise.resolve();

    expect(create.mock.calls[0][0]).toBe(MockAppModule);

    expect(use).toHaveBeenCalledWith('cookie-parser');
    expect(enableCors).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith('4444');
  });
});
