import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { BookingsService } from '../bookings/bookings.service';
import type { BookingSportType } from '../bookings/types/booking.types';
import type { CourtKind } from '../bookings/types/booking.types';
import { User } from '../iam/entities/user.entity';
import { UserRole } from '../iam/entities/user-role.entity';
import type { WhatsappSlotOption } from './entities/whatsapp-conversation.entity';

@Injectable()
export class WhatsappBookingService {
  private readonly logger = new Logger(WhatsappBookingService.name);

  constructor(
    private readonly bookings: BookingsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
  ) {}

  private localPhoneVariants(waId: string): string[] {
    const digits = waId.replace(/\D/g, '');
    const ten =
      digits.length >= 10 ? digits.slice(-10) : digits.replace(/^0+/, '');
    if (!ten) return [];
    return [
      ten,
      `0${ten}`,
      `92${ten}`,
      `+92${ten}`,
      `+${digits}`,
      digits,
    ];
  }

  async ensureCustomerUser(input: {
    waId: string;
    fullName: string;
  }): Promise<User> {
    const variants = this.localPhoneVariants(input.waId);
    if (variants.length) {
      const found = await this.users
        .createQueryBuilder('u')
        .where('u.phone IN (:...variants)', { variants })
        .orWhere('u.phone LIKE :suffix', { suffix: `%${variants[0]}` })
        .getOne();
      if (found) {
        if (
          input.fullName.trim() &&
          (!found.fullName?.trim() || found.fullName.startsWith('WhatsApp'))
        ) {
          found.fullName = input.fullName.trim();
          await this.users.save(found);
        }
        await this.ensureCustomerRole(found.id);
        return found;
      }
    }
    const ten = variants[0] ?? input.waId.replace(/\D/g, '').slice(-10);
    const email = `wa-${ten}-${Date.now()}@velay.local`;
    const passwordHash = await bcrypt.hash(
      `wa-${ten}-${Math.random().toString(36).slice(2)}`,
      10,
    );
    const user = await this.users.save(
      this.users.create({
        fullName: input.fullName.trim() || `WhatsApp ${ten}`,
        email,
        phone: `0${ten}`,
        isActive: true,
        passwordHash,
      }),
    );
    await this.ensureCustomerRole(user.id);
    return user;
  }

  private async ensureCustomerRole(userId: string): Promise<void> {
    const existing = await this.userRoles.findOne({
      where: { userId, roleCode: 'customer-end-user' },
    });
    if (!existing) {
      await this.userRoles.save(
        this.userRoles.create({
          userId,
          roleCode: 'customer-end-user',
        }),
      );
    }
  }

  async createFromSlot(input: {
    tenantId: string;
    userId: string;
    sportType: BookingSportType;
    bookingDate: string;
    slot: WhatsappSlotOption;
    customerName: string;
  }): Promise<{ bookingId: string; reference: string }> {
    const courtKind = input.slot.courtKind as CourtKind;
    const price = Number(input.slot.price) || 0;
    const created = await this.bookings.create(input.tenantId, {
      userId: input.userId,
      sportType: input.sportType,
      bookingDate: input.bookingDate,
      items: [
        {
          courtKind,
          courtId: input.slot.courtId,
          date: input.bookingDate,
          startTime: input.slot.startTime,
          endTime: input.slot.endTime,
          price,
          currency: 'PKR',
          status: 'confirmed',
        },
      ],
      pricing: {
        subTotal: price,
        discount: 0,
        tax: 0,
        totalAmount: price,
      },
      payment: {
        paymentStatus: 'pending',
        paymentMethod: 'cash',
      },
      bookingStatus: 'confirmed',
      notes: `source:whatsapp | ${input.customerName.trim()}`,
    });
    const ref = created.bookingId?.slice(0, 8).toUpperCase() ?? created.bookingId;
    return { bookingId: created.bookingId, reference: ref };
  }

  async tryOneShotBooking(input: {
    tenantId: string;
    locationId: string;
    waId: string;
    message: string;
    referenceDateYmd: string;
  }): Promise<{ reply: string; done: boolean } | null> {
    try {
      const parsed = await this.bookings.parseFreeTextBooking({
        tenantId: input.tenantId,
        message: input.message,
        referenceDateYmd: input.referenceDateYmd,
        businessLocationId: input.locationId,
      });
      if (
        !parsed.bookingDate ||
        !parsed.startTime ||
        !parsed.endTime ||
        !parsed.courtId ||
        !parsed.courtKind
      ) {
        return null;
      }
      const sportMap: Record<string, BookingSportType> = {
        padel: 'padel',
        futsal: 'futsal',
        cricket: 'cricket',
        'table-tennis': 'table-tennis',
      };
      const sport =
        (parsed.inferredSport && sportMap[parsed.inferredSport]) ||
        (parsed.courtKind === 'padel_court'
          ? 'padel'
          : parsed.courtKind === 'table_tennis_court'
            ? 'table-tennis'
            : 'futsal');
      const name = parsed.customerName?.trim() || `WhatsApp ${input.waId.slice(-4)}`;
      const user = await this.ensureCustomerUser({
        waId: input.waId,
        fullName: name,
      });
      const price = Number(parsed.amount ?? 0);
      const slot: WhatsappSlotOption = {
        courtKind: parsed.courtKind,
        courtId: parsed.courtId,
        courtName: parsed.courtName ?? parsed.courtPhrase ?? 'Court',
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        price: price > 0 ? price : 0,
      };
      if (slot.price <= 0) {
        const avail = await this.bookings.getLocationFacilitiesAvailableSlots({
          locationId: input.locationId,
          date: parsed.bookingDate,
          courtType: sport,
        });
        const facility = avail.facilities.find((f) => f.courtId === slot.courtId);
        const match = facility?.slots.find(
          (s) =>
            s.startTime === slot.startTime &&
            s.endTime === slot.endTime &&
            s.availability === 'available',
        );
        if (facility?.price) slot.price = Number(facility.price);
        if (!match) {
          return {
            reply:
              'I understood your booking but that slot is no longer free. Reply *menu* to pick another time.',
            done: false,
          };
        }
      }
      const { reference } = await this.createFromSlot({
        tenantId: input.tenantId,
        userId: user.id,
        sportType: sport,
        bookingDate: parsed.bookingDate,
        slot,
        customerName: name,
      });
      return {
        reply: [
          `Booking confirmed! Ref *${reference}*`,
          `${slot.courtName}`,
          `${parsed.bookingDate} · ${slot.startTime}–${slot.endTime}`,
          slot.price > 0 ? `Rs. ${slot.price.toLocaleString()}` : '',
          'Pay at the venue. Reply *menu* for another booking.',
        ]
          .filter(Boolean)
          .join('\n'),
        done: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`WhatsApp one-shot booking failed: ${msg}`);
      return null;
    }
  }
}
