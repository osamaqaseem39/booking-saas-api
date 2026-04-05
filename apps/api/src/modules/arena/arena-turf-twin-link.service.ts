import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';

/**
 * Keeps futsal↔cricket twin pointers in sync so booking logic can treat one physical turf as one calendar.
 */
@Injectable()
export class ArenaTurfTwinLinkService {
  constructor(
    @InjectRepository(FutsalCourt)
    private readonly futsalRepo: Repository<FutsalCourt>,
    @InjectRepository(CricketCourt)
    private readonly cricketRepo: Repository<CricketCourt>,
  ) {}

  async applyAfterFutsalSaved(
    tenantId: string,
    futsal: FutsalCourt,
    previousTwinId: string | null | undefined,
  ): Promise<void> {
    const nextId = futsal.linkedTwinCourtId ?? null;
    const nextKind = futsal.linkedTwinCourtKind ?? null;

    if (nextId || nextKind) {
      if (!nextId || !nextKind) {
        throw new BadRequestException(
          'Linked pitch kind and id must both be set or both omitted',
        );
      }
      if (nextKind !== 'cricket_court') {
        throw new BadRequestException(
          'A futsal pitch can only link to a cricket pitch',
        );
      }
    }

    if (previousTwinId && previousTwinId !== nextId) {
      const oldTwin = await this.cricketRepo.findOne({
        where: { id: previousTwinId, tenantId },
      });
      if (oldTwin && oldTwin.linkedTwinCourtId === futsal.id) {
        oldTwin.linkedTwinCourtId = undefined;
        oldTwin.linkedTwinCourtKind = undefined;
        await this.cricketRepo.save(oldTwin);
      }
    }

    if (!nextId) {
      return;
    }

    const twin = await this.cricketRepo.findOne({
      where: { id: nextId, tenantId },
    });
    if (!twin) {
      throw new NotFoundException(`Cricket court ${nextId} not found`);
    }
    if ((twin.businessLocationId ?? '') !== (futsal.businessLocationId ?? '')) {
      throw new BadRequestException(
        'Linked pitch must belong to the same location as this futsal pitch',
      );
    }

    const stale = await this.futsalRepo.find({
      where: { tenantId, linkedTwinCourtId: nextId },
    });
    for (const s of stale) {
      if (s.id !== futsal.id) {
        s.linkedTwinCourtId = undefined;
        s.linkedTwinCourtKind = undefined;
        await this.futsalRepo.save(s);
      }
    }

    twin.linkedTwinCourtKind = 'futsal_court';
    twin.linkedTwinCourtId = futsal.id;
    await this.cricketRepo.save(twin);
  }

  async applyAfterCricketSaved(
    tenantId: string,
    cricket: CricketCourt,
    previousTwinId: string | null | undefined,
  ): Promise<void> {
    const nextId = cricket.linkedTwinCourtId ?? null;
    const nextKind = cricket.linkedTwinCourtKind ?? null;

    if (nextId || nextKind) {
      if (!nextId || !nextKind) {
        throw new BadRequestException(
          'Linked pitch kind and id must both be set or both omitted',
        );
      }
      if (nextKind !== 'futsal_court') {
        throw new BadRequestException(
          'A cricket pitch can only link to a futsal pitch',
        );
      }
    }

    if (previousTwinId && previousTwinId !== nextId) {
      const oldTwin = await this.futsalRepo.findOne({
        where: { id: previousTwinId, tenantId },
      });
      if (oldTwin && oldTwin.linkedTwinCourtId === cricket.id) {
        oldTwin.linkedTwinCourtId = undefined;
        oldTwin.linkedTwinCourtKind = undefined;
        await this.futsalRepo.save(oldTwin);
      }
    }

    if (!nextId) {
      return;
    }

    const twin = await this.futsalRepo.findOne({
      where: { id: nextId, tenantId },
    });
    if (!twin) {
      throw new NotFoundException(`Futsal court ${nextId} not found`);
    }
    if ((twin.businessLocationId ?? '') !== (cricket.businessLocationId ?? '')) {
      throw new BadRequestException(
        'Linked pitch must belong to the same location as this cricket pitch',
      );
    }

    const stale = await this.cricketRepo.find({
      where: { tenantId, linkedTwinCourtId: nextId },
    });
    for (const s of stale) {
      if (s.id !== cricket.id) {
        s.linkedTwinCourtId = undefined;
        s.linkedTwinCourtKind = undefined;
        await this.cricketRepo.save(s);
      }
    }

    twin.linkedTwinCourtKind = 'cricket_court';
    twin.linkedTwinCourtId = cricket.id;
    await this.futsalRepo.save(twin);
  }

  async clearPartnerForDeletedFutsal(tenantId: string, futsal: FutsalCourt) {
    if (!futsal.linkedTwinCourtId) return;
    const c = await this.cricketRepo.findOne({
      where: { id: futsal.linkedTwinCourtId, tenantId },
    });
    if (c && c.linkedTwinCourtId === futsal.id) {
      c.linkedTwinCourtId = undefined;
      c.linkedTwinCourtKind = undefined;
      await this.cricketRepo.save(c);
    }
  }

  async clearPartnerForDeletedCricket(tenantId: string, cricket: CricketCourt) {
    if (!cricket.linkedTwinCourtId) return;
    const f = await this.futsalRepo.findOne({
      where: { id: cricket.linkedTwinCourtId, tenantId },
    });
    if (f && f.linkedTwinCourtId === cricket.id) {
      f.linkedTwinCourtId = undefined;
      f.linkedTwinCourtKind = undefined;
      await this.futsalRepo.save(f);
    }
  }
}
