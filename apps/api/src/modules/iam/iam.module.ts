import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from './authz/roles.guard';
import { IamController } from './iam.controller';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { IamService } from './iam.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, UserRole])],
  controllers: [IamController],
  providers: [IamService, RolesGuard],
  exports: [IamService, RolesGuard],
})
export class IamModule {}
