import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async create(payload: Partial<UserEntity>): Promise<UserEntity> {
    const user = this.userRepository.create(payload);
    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(userId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async findMany(
    query: { search?: string; role?: string; isActive?: boolean },
    page: number,
    limit: number,
  ): Promise<{ total: number; items: UserEntity[] }> {
    const where: FindOptionsWhere<UserEntity>[] = [];
    const isActive = query.isActive ?? true;

    if (query.search) {
      where.push({ email: ILike(`%${query.search}%`), isActive });
      where.push({ fullName: ILike(`%${query.search}%`), isActive });
    } else {
      where.push({ isActive });
    }

    const [total, items] = await Promise.all([
      this.userRepository.count({ where }),
      this.userRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const filteredByRole = query.role
      ? items.filter((item) => item.roles.includes(query.role as string))
      : items;
    return { total, items: filteredByRole };
  }

  async updateRefreshTokenHash(userId: string, tokenHash?: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshTokenHash: tokenHash ?? null });
  }
}
