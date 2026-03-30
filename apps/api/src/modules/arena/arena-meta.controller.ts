import { Controller, Get } from '@nestjs/common';
import { ARENA_SUB_TYPE_CODES, ARENA_VERTICAL_CODE } from './arena.constants';

@Controller('arena')
export class ArenaMetaController {
  @Get()
  meta() {
    return {
      vertical: ARENA_VERTICAL_CODE,
      subTypes: [...ARENA_SUB_TYPE_CODES],
      locationScoped: true,
      note: 'POST create bodies require businessLocationId; list with ?businessLocationId= to scope courts to a business location.',
      resources: {
        'turf-court': {
          path: '/arena/turf-courts',
          note: 'Combined Futsal + Cricket setup (single physical court)',
        },
        'cricket-indoor': { path: '/arena/cricket-indoor' },
        'futsal-field': { path: '/arena/futsal-field' },
        'padel-court': { path: '/arena/padel-court' },
      },
    };
  }
}
