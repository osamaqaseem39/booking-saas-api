import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@libs/common/pagination/pagination-query.dto';

export class UsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
