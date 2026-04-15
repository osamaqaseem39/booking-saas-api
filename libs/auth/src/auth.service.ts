import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  async signRefreshToken(payload: JwtPayload, secret: string, expiresIn: string): Promise<string> {
    return this.jwtService.signAsync(payload, { secret, expiresIn });
  }
}
