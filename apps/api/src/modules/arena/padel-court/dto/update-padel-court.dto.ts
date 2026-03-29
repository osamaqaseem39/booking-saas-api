import { PartialType } from '@nestjs/mapped-types';
import { CreatePadelCourtDto } from './create-padel-court.dto';

export class UpdatePadelCourtDto extends PartialType(CreatePadelCourtDto) {}
