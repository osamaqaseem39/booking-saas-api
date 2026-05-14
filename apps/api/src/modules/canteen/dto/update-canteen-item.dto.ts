import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCanteenItemDto } from './create-canteen-item.dto';

export class UpdateCanteenItemDto extends PartialType(
  OmitType(CreateCanteenItemDto, ['locationId'] as const),
) {}
