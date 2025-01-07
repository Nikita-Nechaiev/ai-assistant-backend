import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Token } from './token.model';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly jwtService: JwtService, // Use Nest.js JwtService
  ) {}

  generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '60m', // 60 minutes for access token
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET, // Separate secret for refresh token
      expiresIn: '30d', // 30 days for refresh token
    });

    return { accessToken, refreshToken };
  }

  // Save or update a refresh token for a user
  async saveToken(userId: number, refreshToken: string) {
    const tokenData = await this.tokenRepository.findOne({ where: { userId } });

    if (tokenData) {
      tokenData.refreshToken = refreshToken;
      return this.tokenRepository.save(tokenData);
    }

    const token = this.tokenRepository.create({ userId, refreshToken });
    return this.tokenRepository.save(token);
  }

  async removeToken(refreshToken: string) {
    return await this.tokenRepository.delete({ refreshToken });
  }

  validateRefreshToken(refreshToken: string) {
    try {
      const userData = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET, // Use refresh token secret
      });
      return userData;
    } catch (e) {
      return null;
    }
  }

  validateAccessToken(accessToken: string) {
    try {
      const userData = this.jwtService.verify(accessToken); // Access token secret is already configured in JwtModule
      return userData;
    } catch (e) {
      return null;
    }
  }

  async findToken(refreshToken: string) {
    return await this.tokenRepository.findOne({ where: { refreshToken } });
  }
}
