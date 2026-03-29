import { Injectable } from '@nestjs/common';
import {
  ARENA_SUB_TYPES,
  FACILITY_VERTICALS,
  GAMING_ZONE_SUB_TYPES,
  UPCOMING_TYPES,
} from './product-catalog.constants';

@Injectable()
export class ProductCatalogService {
  getCatalog() {
    return {
      verticals: FACILITY_VERTICALS,
      offerings: {
        arena: ARENA_SUB_TYPES,
        'gaming-zone': GAMING_ZONE_SUB_TYPES,
        snooker: ['snooker-table'],
        'table-tennis': ['table-tennis-table'],
      },
      upcoming: UPCOMING_TYPES,
    };
  }
}
