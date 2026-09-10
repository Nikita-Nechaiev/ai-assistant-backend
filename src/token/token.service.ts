import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Token } from './token.model';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly jwtService: JwtService,
  ) {}

  generateTokens(payload: any) {
    const accessToken = this.generateAccessToken(payload);

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '30d',
      },
    );

    return { accessToken, refreshToken };
  }

  generateAccessToken(payload: any) {
    return this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        expiresIn: '15m',
      },
    );
  }

  async saveToken(userId: number, refreshToken: string) {
    const tokenData = await this.tokenRepository.findOne({ where: { userId } });

    if (tokenData) {
      tokenData.refreshToken = refreshToken;

      return this.tokenRepository.save(tokenData);
    }

    const token = this.tokenRepository.create({ userId, refreshToken });

    return this.tokenRepository.save(token);
  }

  async rotateToken(userId: number, oldRefreshToken: string, newRefreshToken: string) {
    const result = await this.tokenRepository.update(
      { userId, refreshToken: oldRefreshToken },
      { refreshToken: newRefreshToken },
    );

    return (result.affected ?? 0) > 0;
  }

  async removeToken(refreshToken: string) {
    return await this.tokenRepository.delete({ refreshToken });
  }

  async removeTokenByUserId(userId: number) {
    return await this.tokenRepository.delete({ userId });
  }

  validateRefreshToken(refreshToken: string) {
    try {
      const userData = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      return userData;
    } catch (e) {
      return null;
    }
  }

  validateAccessToken(accessToken: string) {
    try {
      const userData = this.jwtService.verify(accessToken);

      return userData;
    } catch (e) {
      return null;
    }
  }

  async findToken(refreshToken: string) {
    return await this.tokenRepository.findOne({ where: { refreshToken } });
  }
}
