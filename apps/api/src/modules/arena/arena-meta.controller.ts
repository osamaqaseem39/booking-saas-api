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
        'cricket-indoor': { path: '/arena/cricket-indoor', label: 'Arena Cricket' },
        'futsal-field': { path: '/arena/futsal-field', label: 'Futsal' },
        'padel-court': { path: '/arena/padel-court', label: 'Padel' },
        'turf-courts': {
          path: '/arena/turf-courts',
          note: 'Optional combined pitch; location must enable Futsal and/or Arena Cricket by sportMode.',
        },
      },
    };
  }
}
