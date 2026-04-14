import { PartialType } from '@nestjs/mapped-types';
import { CreateGamingStationDto } from './create-gaming-station.dto';

export class UpdateGamingStationDto extends PartialType(
  CreateGamingStationDto,
) {}
