import { PartialType } from '@nestjs/mapped-types';
import { CreateTurfCourtDto } from './create-turf-court.dto';

export class UpdateTurfCourtDto extends PartialType(CreateTurfCourtDto) {}
