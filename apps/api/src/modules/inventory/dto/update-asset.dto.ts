import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateAssetDto } from './create-asset.dto';

export class UpdateAssetDto extends PartialType(
  OmitType(CreateAssetDto, ['locationId'] as const),
) {}
