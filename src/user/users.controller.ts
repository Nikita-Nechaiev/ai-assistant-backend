import { Controller, Get, Patch, UseGuards, UploadedFile, UseInterceptors, Body, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('all-users')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(@Req() req, @Body() dto: UpdateProfileDto, @UploadedFile() avatar?: Express.Multer.File) {
    const userId = req.user.id;
    const updated = await this.usersService.updateProfile(userId, dto, avatar);

    return { message: 'Profile updated', user: updated };
  }
}
