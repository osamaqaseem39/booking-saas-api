import { Body, Controller, Post } from '@nestjs/common';
import { BootstrapFirstOwnerDto } from './dto/bootstrap-first-owner.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<{ token: string }> {
    return this.authService.login(dto);
  }

  @Post('bootstrap-first-owner')
  async bootstrapFirstOwner(
    @Body() dto: BootstrapFirstOwnerDto,
  ): Promise<{ token: string; userId: string; email: string }> {
    return this.authService.bootstrapFirstOwner(dto);
  }
}
