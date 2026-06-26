import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../iam/entities/user.entity';
import { TournamentRegistration } from '../tournaments/entities/tournament-registration.entity';
import { TeamMember } from '../tournaments/entities/team-member.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentDivision } from '../tournaments/entities/tournament-division.entity';
import { CanteenOrder } from '../canteen/entities/canteen-order.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { JourneyEvent } from './entities/journey-event.entity';

function numFromDec(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

@Injectable()
export class JourneyService {
  constructor(
    @InjectRepository(JourneyEvent)
    private readonly events: Repository<JourneyEvent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentDivision)
    private readonly divisions: Repository<TournamentDivision>,
    @InjectRepository(CanteenOrder)
    private readonly canteenOrders: Repository<CanteenOrder>,
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
  ) {}

  async trackEvent(
    userId: string,
    tenantId: string | undefined,
    dto: {
      eventType: string;
      sessionId?: string;
      properties?: Record<string, unknown>;
      occurredAt?: string;
    },
  ) {
    const row = await this.events.save({
      userId,
      tenantId: tenantId ?? null,
      sessionId: dto.sessionId ?? null,
      eventType: dto.eventType.trim().slice(0, 64),
      properties: dto.properties ?? {},
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    });
    return { id: row.id, ok: true as const };
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const bookings = await this.bookings.find({ where: { userId } });
    const completed = bookings.filter((b) => b.bookingStatus === 'completed');
    const cancelled = bookings.filter((b) => b.bookingStatus === 'cancelled');
    const noShow = bookings.filter((b) => b.bookingStatus === 'no_show');
    const paidBookings = bookings.filter((b) => b.paymentStatus === 'paid');
    const totalSpent = paidBookings.reduce(
      (sum, b) => sum + numFromDec(b.paidAmount || b.totalAmount),
      0,
    );

    const sportCounts = new Map<string, number>();
    for (const b of bookings) {
      sportCounts.set(b.sportType, (sportCounts.get(b.sportType) ?? 0) + 1);
    }
    const favoriteSport =
      [...sportCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const upcomingBookingsCount = bookings.filter((b) =>
      ['pending', 'confirmed', 'live'].includes(b.bookingStatus),
    ).length;

    const lastBooking = bookings.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];

    const memberships = await this.teamMembers.find({ where: { userId } });
    const teamIds = memberships.map((m) => m.teamId);
    const regs =
      teamIds.length > 0
        ? await this.registrations.find({
            where: { teamId: In(teamIds) },
          })
        : [];
    const activeCount = regs.filter((r) =>
      ['pending', 'approved', 'waitlisted'].includes(r.status),
    ).length;

    return {
      userId: user.id,
      fullName: user.fullName,
      memberSince: user.createdAt.toISOString(),
      stats: {
        totalBookings: bookings.length,
        completedBookings: completed.length,
        cancelledBookings: cancelled.length,
        noShowBookings: noShow.length,
        totalSpent,
        currency: 'PKR',
        favoriteSport,
        favoriteVenueId: null,
        favoriteVenueName: null,
        lastBookingAt: lastBooking?.createdAt.toISOString() ?? null,
        upcomingBookingsCount,
      },
      tournaments: {
        registrationsCount: regs.length,
        activeCount,
      },
    };
  }

  async getTimeline(
    userId: string,
    opts?: { page?: number; limit?: number; types?: string },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
    const allowedTypes = opts?.types
      ? opts.types.split(',').map((t) => t.trim()).filter(Boolean)
      : ['booking', 'tournament', 'payment', 'canteen', 'support'];

    type TimelineItem = {
      id: string;
      type: string;
      title: string;
      description?: string;
      entityType: string;
      entityId: string;
      occurredAt: string;
      metadata: Record<string, unknown>;
    };

    const items: TimelineItem[] = [];

    if (allowedTypes.includes('booking')) {
      const bookings = await this.bookings.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      for (const b of bookings) {
        items.push({
          id: `booking-${b.id}`,
          type: 'booking',
          title:
            b.paymentStatus === 'paid'
              ? `${b.sportType} booking confirmed`
              : `${b.sportType} booking created`,
          entityType: 'booking',
          entityId: b.id,
          occurredAt: (b.paidAt ?? b.createdAt).toISOString(),
          metadata: {
            sportType: b.sportType,
            paymentStatus: b.paymentStatus,
            amount: numFromDec(b.totalAmount),
          },
        });
      }
    }

    if (allowedTypes.includes('tournament')) {
      const memberships = await this.teamMembers.find({ where: { userId } });
      const teamIds = memberships.map((m) => m.teamId);
      if (teamIds.length > 0) {
        const regs = await this.registrations.find({
          where: { teamId: In(teamIds) },
          order: { createdAt: 'DESC' },
        });
        const divisions = await this.divisions.find({
          where: { id: In(regs.map((r) => r.divisionId)) },
        });
        const dMap = new Map(divisions.map((d) => [d.id, d]));
        const events = await this.tournaments.find({
          where: { id: In(divisions.map((d) => d.tournamentId)) },
        });
        const eMap = new Map(events.map((e) => [e.id, e]));
        for (const r of regs) {
          const d = dMap.get(r.divisionId);
          const t = d ? eMap.get(d.tournamentId) : undefined;
          items.push({
            id: `tournament-${r.id}`,
            type: 'tournament',
            title: `Registered for ${t?.name ?? 'tournament'}`,
            entityType: 'tournament_registration',
            entityId: r.id,
            occurredAt: r.createdAt.toISOString(),
            metadata: {
              paymentStatus: r.paymentStatus,
            },
          });
        }
      }
    }

    if (allowedTypes.includes('canteen')) {
      const orders = await this.canteenOrders.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      for (const o of orders) {
        items.push({
          id: `canteen-${o.id}`,
          type: 'canteen',
          title: `Canteen order ${o.status}`,
          entityType: 'canteen_order',
          entityId: o.id,
          occurredAt: o.createdAt.toISOString(),
          metadata: {
            paymentStatus: o.paymentStatus,
            amount: numFromDec(o.totalAmount),
          },
        });
      }
    }

    if (allowedTypes.includes('support')) {
      const tickets = await this.tickets.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      for (const t of tickets) {
        items.push({
          id: `support-${t.id}`,
          type: 'support',
          title: t.subject,
          entityType: 'support_ticket',
          entityId: t.id,
          occurredAt: (t.lastMessageAt ?? t.createdAt).toISOString(),
          metadata: { status: t.status, category: t.category },
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    const total = items.length;
    const slice = items.slice((page - 1) * limit, page * limit);
    return { items: slice, page, limit, total };
  }
}
