import { PartialType } from '@nestjs/mapped-types';
import { CreateTimeSlotTemplateDto } from './create-time-slot-template.dto';

export class UpdateTimeSlotTemplateDto extends PartialType(
  CreateTimeSlotTemplateDto,
) {}
