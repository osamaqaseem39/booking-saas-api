import { PartialType } from '@nestjs/swagger';
import { CreateCanteenItemDto } from './create-canteen-item.dto';

export class UpdateCanteenItemDto extends PartialType(CreateCanteenItemDto) {}
