import { PartialType } from '@nestjs/mapped-types';
import { CreateCricketCourtDto } from './create-cricket-court.dto';

export class UpdateCricketCourtDto extends PartialType(CreateCricketCourtDto) {}
