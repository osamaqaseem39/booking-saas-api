import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { AuthService, JwtPayload } from '@libs/auth/auth.service';
import { REDIS_CLIENT } from '@libs/database/redis/redis.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersRepository } from './users.repository';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      roles: dto.roles?.length ? dto.roles : ['user'],
      isActive: true,
    });

    await this.redis.del('users:list:invalidated');
    await this.queueService.enqueueWelcomeEmail(user.id, user.email);
    return user;
  }

  async list(query: UsersQueryDto) {
    const cacheKey = `users:list:${query.page}:${query.limit}:${query.search ?? ''}:${query.role ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.usersRepository.findMany(
      { search: query.search, role: query.role, isActive: true },
      query.page,
      query.limit,
    );
    const result = {
      ...data,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(data.total / query.limit),
    };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    return result;
  }

  async login(email: string, password: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
    const accessToken = await this.authService.signAccessToken(payload);
    const refreshToken = await this.authService.signRefreshToken(
      payload,
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      this.configService.get<string>('JWT_REFRESH_TTL', '7d'),
    );

    await this.usersRepository.updateRefreshTokenHash(user.id, await bcrypt.hash(refreshToken, 10));
    return { accessToken, refreshToken };
  }

  async profile(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
