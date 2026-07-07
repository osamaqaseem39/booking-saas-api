import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
