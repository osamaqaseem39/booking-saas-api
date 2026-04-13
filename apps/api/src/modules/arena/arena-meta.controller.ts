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
      facilityTypeCodes: ['futsal', 'cricket', 'padel'],
      note: 'POST create bodies require businessLocationId; list with ?businessLocationId= to scope courts to a business location.',
      resources: {
        'futsal-courts': { path: '/arena/futsal-courts', label: 'Futsal pitch' },
        'cricket-courts': {
          path: '/arena/cricket-courts',
          label: 'Cricket pitch',
        },
        'turf-twin-links': {
          path: '/arena/turf-twin-links/link',
          label: 'Link futsal + cricket as one shared turf calendar',
        },
        'padel-court': { path: '/arena/padel-court', label: 'Padel' },
      },
    };
  }
}
