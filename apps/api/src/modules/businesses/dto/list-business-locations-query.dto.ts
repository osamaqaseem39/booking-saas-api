import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Query params for GET /businesses/locations (optional filters). */
export class ListBusinessLocationsQueryDto {
  /**
   * Case-insensitive substring match on the location display name
   * (`business_locations.name`).
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
