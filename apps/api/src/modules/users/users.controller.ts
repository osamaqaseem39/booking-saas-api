import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '@libs/auth/jwt-auth.guard';
import { RolesGuard } from '@libs/auth/roles.guard';
import { Roles } from '@libs/auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform-owner', 'admin')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform-owner', 'admin')
  list(@Query() query: UsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto.email, dto.password);
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.usersService.profile(req.user.sub);
  }
}
