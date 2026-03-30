import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '../iam/entities/role.entity';
import { User } from '../iam/entities/user.entity';
import { UserRole } from '../iam/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, UserRole])],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
})
export class AuthModule {}
