import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '../iam/entities/role.entity';
import { User } from '../iam/entities/user.entity';
import { UserRole } from '../iam/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRole]),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ??
        process.env.SUPABASE_JWT_SECRET ??
        process.env.SUPABASE_SECRET_KEY ??
        'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
