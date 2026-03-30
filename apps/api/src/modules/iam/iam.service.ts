import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { SystemRole } from './iam.constants';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';

@Injectable()
export class IamService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedSystemRoles();
  }

  async getMe(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const roleRows = await this.userRolesRepository.find({ where: { userId } });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      roles: roleRows.map((r) => r.roleCode),
    };
  }

  async listUsers() {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    const userRoles = await this.userRolesRepository.find();
    return users.map((user) => ({
      ...user,
      roles: userRoles
        .filter((userRole) => userRole.userId === user.id)
        .map((userRole) => userRole.roleCode),
    }));
  }

  /** Users who have the customer-end-user role (plus their other roles). */
  async listEndUsers() {
    const endRows = await this.userRolesRepository.find({
      where: { roleCode: 'customer-end-user' },
    });
    const userIds = [...new Set(endRows.map((r) => r.userId))];
    if (userIds.length === 0) return [];
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      order: { createdAt: 'DESC' },
    });
    const allRoles = await this.userRolesRepository.find({
      where: { userId: In(userIds) },
    });
    return users.map((user) => ({
      ...user,
      roles: allRoles
        .filter((r) => r.userId === user.id)
        .map((r) => r.roleCode),
    }));
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException(`User with email ${dto.email} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = this.usersRepository.create({
      fullName: dto.fullName,
      email,
      phone: dto.phone,
      isActive: true,
      passwordHash,
    });
    return this.usersRepository.save(created);
  }

  async ensureUser(input: CreateUserDto): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (!existing) {
      return this.createUser({ ...input, email });
    }

    // Backfill password if the user was created before password support was added.
    if (!existing.passwordHash) {
      existing.passwordHash = await bcrypt.hash(input.password, 10);
      return this.usersRepository.save(existing);
    }

    return existing;
  }

  async assignRole(userId: string, roleCode: SystemRole): Promise<UserRole> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} does not exist`);
    }

    const role = await this.rolesRepository.findOne({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException(`Role ${roleCode} does not exist`);
    }

    const existing = await this.userRolesRepository.findOne({
      where: { userId, roleCode },
    });
    if (existing) return existing;

    const record = this.userRolesRepository.create({
      userId,
      roleCode,
    });
    return this.userRolesRepository.save(record);
  }

  async hasAnyRole(userId: string, roles: SystemRole[]): Promise<boolean> {
    const count = await this.userRolesRepository.count({
      where: roles.map((roleCode) => ({ userId, roleCode })),
    });
    return count > 0;
  }

  async seedSystemRoles(): Promise<void> {
    const seeds: Role[] = [
      { code: 'platform-owner', name: 'Platform Owner', createdAt: new Date() },
      { code: 'business-admin', name: 'Business Admin', createdAt: new Date() },
      { code: 'business-staff', name: 'Business Staff', createdAt: new Date() },
      {
        code: 'customer-end-user',
        name: 'Customer / End User',
        createdAt: new Date(),
      },
    ];

    for (const role of seeds) {
      const exists = await this.rolesRepository.findOne({
        where: { code: role.code },
      });
      if (!exists) {
        const created = this.rolesRepository.create({
          code: role.code,
          name: role.name,
        });
        await this.rolesRepository.save(created);
      }
    }
  }
}
