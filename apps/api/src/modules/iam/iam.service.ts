import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
    @InjectRepository(Business)
    private readonly businessesRepository: Repository<Business>,
    @InjectRepository(BusinessMembership)
    private readonly membershipsRepository: Repository<BusinessMembership>,
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

  private async coworkerUserIdsFor(requesterUserId: string): Promise<string[]> {
    const myMemberships = await this.membershipsRepository.find({
      where: { userId: requesterUserId },
    });
    const businessIds = [...new Set(myMemberships.map((m) => m.businessId))];
    if (businessIds.length === 0) return [];
    const rows = await this.membershipsRepository.find({
      where: { businessId: In(businessIds) },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  private async assertCanManageUser(
    requesterId: string,
    targetUserId: string,
    isPlatformOwner: boolean,
    action: 'update' | 'delete',
  ): Promise<void> {
    if (isPlatformOwner) return;
    if (action === 'delete' && requesterId === targetUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }
    if (requesterId === targetUserId) {
      return;
    }
    const myCoworkers = new Set(await this.coworkerUserIdsFor(requesterId));
    if (!myCoworkers.has(targetUserId)) {
      throw new ForbiddenException(
        'You can only manage users in your business',
      );
    }
    if (await this.hasAnyRole(targetUserId, ['platform-owner'])) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async listUsers(
    requesterUserId: string,
    isPlatformOwner: boolean,
    input?: {
      tenantId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const businessRoles: SystemRole[] = isPlatformOwner
      ? ['platform-owner', 'business-admin', 'business-staff', 'customer-end-user']
      : ['business-admin', 'business-staff'];
    const businessRoleRows = await this.userRolesRepository.find({
      where: { roleCode: In(businessRoles) },
    });
    let businessUserIds = [...new Set(businessRoleRows.map((r) => r.userId))];
    const tenantId = (input?.tenantId ?? '').trim();
    if (tenantId && tenantId !== 'public') {
      const business = await this.businessesRepository.findOne({
        where: { tenantId },
      });
      if (!business) return [];
      const tenantMemberships = await this.membershipsRepository.find({
        where: { businessId: business.id },
      });
      const tenantUserIds = new Set(tenantMemberships.map((m) => m.userId));
      if (!isPlatformOwner && !tenantUserIds.has(requesterUserId)) {
        throw new ForbiddenException('You can only view users in your business');
      }
      businessUserIds = businessUserIds.filter((id) => tenantUserIds.has(id));
    }
    if (!isPlatformOwner) {
      const coworkers = new Set(await this.coworkerUserIdsFor(requesterUserId));
      businessUserIds = businessUserIds.filter((id) => coworkers.has(id));
    }
    if (businessUserIds.length === 0) return [];

    const search = (input?.search ?? '').trim().toLowerCase();
    const sortByInput = (input?.sortBy ?? '').trim().toLowerCase();
    const sortOrderInput = (input?.sortOrder ?? '').trim().toUpperCase();

    const sortBy =
      sortByInput === 'fullname'
        ? 'fullName'
        : sortByInput === 'email'
          ? 'email'
          : sortByInput === 'createdat'
            ? 'createdAt'
            : 'createdAt';
    const sortOrder =
      sortOrderInput === 'ASC' || sortOrderInput === 'DESC'
        ? sortOrderInput
        : 'DESC';

    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: businessUserIds });

    if (search) {
      query.andWhere(
        "(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(COALESCE(user.phone, '')) LIKE :search)",
        { search: `%${search}%` },
      );
    }

    query.orderBy(`user.${sortBy}`, sortOrder);
    const users = await query.getMany();
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return [];

    const userRoles = await this.userRolesRepository.find({
      where: { userId: In(userIds) },
    });
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

  async createUser(
    dto: CreateUserDto,
    opts?: { requesterId: string; isPlatformOwner: boolean; tenantId: string },
  ): Promise<User> {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        `User with email ${dto.email} already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = this.usersRepository.create({
      fullName: dto.fullName,
      email,
      phone: dto.phone,
      isActive: true,
      passwordHash,
    });
    const saved = await this.usersRepository.save(created);

    if (opts && !opts.isPlatformOwner) {
      const tid = (opts.tenantId ?? '').trim();
      if (!tid || tid === 'public') {
        throw new BadRequestException(
          'Send x-tenant-id for the business when creating users as a business admin',
        );
      }
      const business = await this.businessesRepository.findOne({
        where: { tenantId: tid },
      });
      if (!business) {
        throw new NotFoundException('Business not found for this tenant');
      }
      const requesterMember = await this.membershipsRepository.findOne({
        where: { businessId: business.id, userId: opts.requesterId },
      });
      if (!requesterMember) {
        throw new ForbiddenException('You are not a member of this business');
      }
      await this.assignRole(saved.id, 'business-staff');
      const membership = this.membershipsRepository.create({
        businessId: business.id,
        userId: saved.id,
        membershipRole: 'staff',
      });
      await this.membershipsRepository.save(membership);
    }

    return saved;
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    opts: { requesterId: string; isPlatformOwner: boolean },
  ): Promise<User> {
    await this.assertCanManageUser(
      opts.requesterId,
      userId,
      opts.isPlatformOwner,
      'update',
    );
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (dto.email && dto.email.toLowerCase() !== user.email.toLowerCase()) {
      const exists = await this.usersRepository.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (exists && exists.id !== userId) {
        throw new BadRequestException(
          `User with email ${dto.email} already exists`,
        );
      }
      user.email = dto.email.toLowerCase();
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.usersRepository.save(user);
  }

  async deleteUser(
    userId: string,
    opts: { requesterId: string; isPlatformOwner: boolean },
  ): Promise<{ deactivated: true; userId: string }> {
    await this.assertCanManageUser(
      opts.requesterId,
      userId,
      opts.isPlatformOwner,
      'delete',
    );
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (!user.isActive) {
      return { deactivated: true, userId };
    }
    user.isActive = false;
    await this.usersRepository.save(user);
    return { deactivated: true, userId };
  }

  /** Platform-owner only (enforced in controller). */
  async activateUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    user.isActive = true;
    await this.usersRepository.save(user);
    return this.getMe(userId);
  }

  async assertRequesterActive(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid authentication');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }
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

    const role = await this.rolesRepository.findOne({
      where: { code: roleCode },
    });
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
        try {
          await this.rolesRepository.save(created);
        } catch (err) {
          // Serverless cold starts can run in parallel. Both instances may
          // pass the `exists` check, so ignore unique constraint violations.
          if (err instanceof QueryFailedError) {
            const code = (err as any).code;
            if (code === '23505') continue; // unique_violation
          }
          throw err;
        }
      }
    }
  }
}
