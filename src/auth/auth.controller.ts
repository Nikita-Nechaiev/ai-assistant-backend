import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
      });
    }

    return { accessToken, user };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('avatar'))
  async register(
    @Body() registerDto: RegisterDto,
    @UploadedFile() avatar: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.register(
      registerDto,
      avatar,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
      });
    }

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    await this.authService.logout(refreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });

    return { message: 'Logged out successfully' };
  }

  @Get('refresh-cookies')
  @HttpCode(HttpStatus.OK)
  async setRefreshCookie(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    const { refreshToken: newRefreshToken, accessToken } =
      await this.authService.refresh(refreshToken);

    if (newRefreshToken) {
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
      });
    }

    return { message: 'Refresh token set in cookies' };
  }

  @Get('get-tokens')
  @HttpCode(HttpStatus.OK)
  async refreshWithToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    const {
      refreshToken: newRefreshToken,
      accessToken,
      user,
    } = await this.authService.refresh(refreshToken);

    return { accessToken, newRefreshToken, user };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async sendResetPasswordLink(@Body('email') email: string) {
    return this.authService.sendResetPasswordLink(email);
  }

  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('token') token: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    console.log('resetPasswordDto', resetPasswordDto);
    return this.authService.resetPassword(token, resetPasswordDto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(@Req() req, @Res({ passthrough: true }) res) {
    try {
      const { accessToken, refreshToken } = await this.authService.oauthLogin(
        req.user,
      );

      res.cookie('refreshToken', refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.cookie('accessToken', accessToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      const frontendUrl = `${process.env.FRONTEND_URL}/`;
      return res.redirect(frontendUrl);
    } catch (error) {
      console.error('Error during Google login callback:', error);

      const loginUrl = `${process.env.FRONTEND_URL}/login`;
      return res.redirect(loginUrl);
    }
  }
}
