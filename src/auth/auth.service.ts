import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/user/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from 'src/email/email.service';
import { TokenService } from 'src/token/token.service';
import { FileService } from 'src/file/file.service';
import { User } from 'src/user/user.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly fileService: FileService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
  ) {}

  private async generateAndSaveTokens(user: Partial<User>) {
    const payload = { sub: user.id, email: user.email };
    const { accessToken, refreshToken } =
      this.tokenService.generateTokens(payload);
    await this.tokenService.saveToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<null | Partial<User>> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async register(
    registerDto: RegisterDto,
    avatarFile?: Express.Multer.File,
  ): Promise<{
    refreshToken: string;
    accessToken: string;
    user: Partial<User>;
  }> {
    const { email, password, name } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarPath = await this.fileService.saveAvatarFile(avatarFile);

    const user = await this.usersService.createUser({
      email,
      name,
      passwordHash: hashedPassword,
      avatar: avatarPath,
    });

    const tokens = await this.generateAndSaveTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto): Promise<{
    refreshToken: string;
    accessToken: string;
    user: Partial<User>;
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateAndSaveTokens(user);

    return {
      ...tokens,
      user,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    if (!(await this.tokenService.removeToken(refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async refresh(refreshToken: string): Promise<{
    refreshToken: string;
    accessToken: string;
    user: Partial<User>;
  }> {
    const userData = this.tokenService.validateRefreshToken(refreshToken);
    if (!userData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(userData.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateAndSaveTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async oauthLogin(user: User) {
    const tokens = await this.generateAndSaveTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async sendResetPasswordLink(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await this.usersService.updateResetToken(
      user.id,
      hashedToken,
      Date.now() + 3600000,
    );
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await this.emailService.sendResetPasswordEmail(user.email, resetLink);
  }

  async resetPassword(
    token: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findByResetToken(token);
    if (!user || Date.now() > user.resetTokenExpires) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
