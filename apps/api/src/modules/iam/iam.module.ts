import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from './authz/roles.guard';
import { ConsumerAuthGuard } from './authz/consumer-auth.guard';
import { IamController } from './iam.controller';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UserPermission } from './entities/user-permission.entity';
import { IamService } from './iam.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRole,
      UserPermission,
      Business,
      BusinessMembership,
      BusinessLocation,
      Booking,
    ]),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ??
        process.env.SUPABASE_JWT_SECRET ??
        process.env.SUPABASE_SECRET_KEY ??
        'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any,
      },
    }),
  ],
  controllers: [IamController],
  providers: [IamService, RolesGuard, ConsumerAuthGuard],
  exports: [IamService, RolesGuard, ConsumerAuthGuard, JwtModule],
})
export class IamModule {}
