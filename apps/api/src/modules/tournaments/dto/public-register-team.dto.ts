import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TeamMemberInputDto } from './register-team.dto';

/** Guest / public tournament registration (no auth). */
export class PublicRegisterTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  teamName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  contactName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(32)
  contactPhone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberInputDto)
  members?: TeamMemberInputDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;
}
