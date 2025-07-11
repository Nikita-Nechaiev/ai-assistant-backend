import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let superCanActivate: jest.Mock;

  beforeEach(() => {
    const SuperGuard = AuthGuard('jwt');

    superCanActivate = jest.fn().mockReturnValue(true);

    guard = new JwtAuthGuard();

    (guard as any).super = { canActivate: superCanActivate };
    jest.spyOn(SuperGuard.prototype, 'canActivate').mockImplementation(superCanActivate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw UnauthorizedException if no accessToken', () => {
    const mockRequest: any = {
      cookies: {},
      headers: {},
    };

    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    };

    expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(UnauthorizedException);
  });

  it('should set authorization header and call super.canActivate', () => {
    const mockRequest: any = {
      cookies: { accessToken: 'test-token' },
      headers: {},
    };

    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    };

    const result = guard.canActivate(mockContext as ExecutionContext);

    expect(mockRequest.headers.authorization).toBe('Bearer test-token');
    expect(superCanActivate).toHaveBeenCalledWith(mockContext);
    expect(result).toBe(true);
  });
});
