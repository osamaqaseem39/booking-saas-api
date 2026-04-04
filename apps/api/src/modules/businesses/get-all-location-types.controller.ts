import { Controller, Get } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

/**
 * Canonical registered types (arena, gaming-zone, …) merged with every distinct
 * `locationType` stored on any location row. Alias-style path for end-user apps.
 */
@Controller('getAllLocationTypes')
export class GetAllLocationTypesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  getAllLocationTypes() {
    return this.businessesService.listAllRegisteredLocationTypesPublic();
  }
}
