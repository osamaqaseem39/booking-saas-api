import { PartialType } from '@nestjs/mapped-types';
import { CreateFutsalCourtDto } from './create-futsal-court.dto';

export class UpdateFutsalCourtDto extends PartialType(CreateFutsalCourtDto) {}
