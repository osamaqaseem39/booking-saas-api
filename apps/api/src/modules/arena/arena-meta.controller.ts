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
      facilityTypeCodes: ['padel'],
      note: 'POST create bodies require businessLocationId; list with ?businessLocationId= to scope courts to a business location.',
      resources: {
        'padel-court': { path: '/arena/padel-court', label: 'Padel' },
      },
    };
  }
}
