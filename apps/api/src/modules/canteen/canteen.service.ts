import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CanteenItem } from './entities/canteen-item.entity';
import { CreateCanteenItemDto } from './dto/create-canteen-item.dto';
import { UpdateCanteenItemDto } from './dto/update-canteen-item.dto';

@Injectable()
export class CanteenService {
  constructor(
    @InjectRepository(CanteenItem)
    private readonly canteenItemRepository: Repository<CanteenItem>,
  ) {}

  async create(createCanteenItemDto: CreateCanteenItemDto): Promise<CanteenItem> {
    const item = this.canteenItemRepository.create(createCanteenItemDto);
    return await this.canteenItemRepository.save(item);
  }

  async findAll(locationId?: string): Promise<CanteenItem[]> {
    if (locationId) {
      return await this.canteenItemRepository.find({
        where: { locationId },
        order: { name: 'ASC' },
      });
    }
    return await this.canteenItemRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<CanteenItem> {
    const item = await this.canteenItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Canteen item with ID ${id} not found`);
    }
    return item;
  }

  async update(id: string, updateCanteenItemDto: UpdateCanteenItemDto): Promise<CanteenItem> {
    const item = await this.findOne(id);
    Object.assign(item, updateCanteenItemDto);
    return await this.canteenItemRepository.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.canteenItemRepository.remove(item);
  }
}
