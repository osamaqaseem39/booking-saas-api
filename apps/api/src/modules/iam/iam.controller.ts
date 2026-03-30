import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from './authz/roles.guard';
import { Roles } from './authz/roles.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { IamService } from './iam.service';
import { SYSTEM_ROLES } from './iam.constants';

@Controller('iam')
@UseGuards(RolesGuard)
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('me')
  @Roles(...SYSTEM_ROLES)
  async me(@Req() req: Request) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.iamService.getMe(userId);
  }

  @Get('users')
  @Roles('platform-owner', 'business-admin')
  async listUsers() {
    return this.iamService.listUsers();
  }

  @Get('end-users')
  @Roles('platform-owner')
  async listEndUsers() {
    return this.iamService.listEndUsers();
  }

  @Post('users')
  @Roles('platform-owner', 'business-admin')
  async createUser(@Body() dto: CreateUserDto) {
    return this.iamService.createUser(dto);
  }

  @Patch('users/:userId')
  @Roles('platform-owner', 'business-admin')
  async updateUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.iamService.updateUser(userId, dto);
  }

  @Delete('users/:userId')
  @Roles('platform-owner', 'business-admin')
  async deleteUser(@Param('userId') userId: string) {
    return this.iamService.deleteUser(userId);
  }

  @Post('roles/assign')
  @Roles('platform-owner')
  async assignRole(@Body() dto: AssignRoleDto) {
    return this.iamService.assignRole(dto.userId, dto.role);
  }
}
