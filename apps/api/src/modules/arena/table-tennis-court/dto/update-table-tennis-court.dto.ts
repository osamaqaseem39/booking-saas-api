import { PartialType } from '@nestjs/mapped-types';
import { CreateTableTennisCourtDto } from './create-table-tennis-court.dto';

export class UpdateTableTennisCourtDto extends PartialType(
  CreateTableTennisCourtDto,
) {}
