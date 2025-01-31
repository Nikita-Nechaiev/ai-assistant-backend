import { Controller, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

import { Get } from '@nestjs/common';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get('/')
  async findAll() {
    return this.invitationService.findAll();
  }

  @Post('/create')
  async create(@Body() createInvitationDto: CreateInvitationDto) {
    return this.invitationService.create(createInvitationDto);
  }

  @Put('/:id')
  async update(
    @Param('id') id: number,
    @Body() updateInvitationDto: UpdateInvitationDto,
  ) {
    return this.invitationService.update(id, updateInvitationDto);
  }

  @Delete('/:id')
  async delete(@Param('id') id: number) {
    return this.invitationService.delete(id);
  }
}
