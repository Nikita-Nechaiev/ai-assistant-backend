import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from 'src/user/users.service';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from 'src/email/email.service';
import { TokenService } from 'src/token/token.service';
import { User } from 'src/user/user.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async register(registerDto: RegisterDto, avatarFile?: Express.Multer.File) {
    const { email, password, name } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 6);

    let avatarPath = '/uploads/avatars/default-ava.webp';
    if (avatarFile) {
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const fileExtension = path.extname(avatarFile.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      avatarPath = `/uploads/avatars/${fileName}`;
      fs.writeFileSync(path.join(uploadDir, fileName), avatarFile.buffer);
    }

    const user = await this.usersService.createUser({
      email,
      name,
      passwordHash: hashedPassword,
      avatar: avatarPath,
    });

    const payload = { sub: user.id, email: user.email };
    const { accessToken, refreshToken } =
      this.tokenService.generateTokens(payload);

    await this.tokenService.saveToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const { accessToken, refreshToken } =
      this.tokenService.generateTokens(payload);

    await this.tokenService.saveToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const token = await this.tokenService.findToken(refreshToken);
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.tokenService.removeToken(refreshToken);
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; newRefreshToken: string; user: User }> {
    const userData = this.tokenService.validateRefreshToken(refreshToken);
    if (!userData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenFromDb = await this.tokenService.findToken(refreshToken);
    if (!tokenFromDb) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const user = await this.usersService.findById(Number(userData.sub));
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user.id, email: user.email };
    const tokens = this.tokenService.generateTokens(payload);

    await this.tokenService.saveToken(user.id, tokens.refreshToken);

    delete user.passwordHash;

    return {
      accessToken: tokens.accessToken,
      newRefreshToken: tokens.refreshToken,
      user,
    };
  }

  async oauthLogin(user: any) {
    const payload = { sub: user.id, email: user.email };

    const { accessToken, refreshToken } =
      this.tokenService.generateTokens(payload);

    await this.tokenService.saveToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async sendResetPasswordLink(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(
        'If the email exists, a password reset link will be sent.',
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await this.usersService.updateResetToken(
      user.id,
      hashedToken,
      Date.now() + 3600000,
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await this.emailService.sendMail(
      user.email,
      'Password Reset Request',
      `We received a request to reset your password. Use the link below to reset your password: ${resetLink}`,
      `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${resetLink}" style="display: inline-block; background-color: #007BFF; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        <p>Thanks,<br>Ai Powered Assistant Team</p>
      </div>
    `,
    );

    console.log(`Password reset link sent to: ${email}`);
  }

  async resetPassword(
    token: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<void> {
    const { password } = resetPasswordDto;
    console.log('passwor1', password);
    console.log('token', token);

    const user = await this.usersService.findByResetToken(token);
    console.log('password2', password);

    if (!user || Date.now() > user.resetTokenExpires) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    console.log('password3', password)
    const hashedPassword = await bcrypt.hash(password, 10);

    await this.usersService.updatePassword(user.id, hashedPassword);
  }
}
