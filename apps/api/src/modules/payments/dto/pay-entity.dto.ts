import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PayEntityDto {
  @IsIn(['jazzcash', 'easypaisa'])
  gateway!: 'jazzcash' | 'easypaisa';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerMobile?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;
}
