import { Body, Controller, Post } from '@nestjs/common';
import { BootstrapFirstOwnerDto } from './dto/bootstrap-first-owner.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterEndUserDto } from './dto/register-end-user.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
  ): Promise<{
    token: string;
    refreshToken: string;
    user: {
      id: string;
      fullName: string;
      email: string;
      phone?: string;
      isActive: boolean;
      roles: string[];
    };
  }> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<{ token: string; refreshToken: string }> {
    return this.authService.refresh(dto);
  }

  @Post('bootstrap-first-owner')
  async bootstrapFirstOwner(
    @Body() dto: BootstrapFirstOwnerDto,
  ): Promise<{ token: string; refreshToken: string; userId: string; email: string }> {
    return this.authService.bootstrapFirstOwner(dto);
  }

  @Post('register-end-user')
  async registerEndUser(
    @Body() dto: RegisterEndUserDto,
  ): Promise<{ token: string; refreshToken: string; userId: string; email: string }> {
    return this.authService.registerEndUser(dto);
  }
}
