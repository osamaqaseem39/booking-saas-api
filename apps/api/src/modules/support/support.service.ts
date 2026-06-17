import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../iam/entities/user.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportTicketMessage } from './entities/support-ticket-message.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messages: Repository<SupportTicketMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private async nextTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.tickets.count();
    const seq = String(count + 1).padStart(4, '0');
    return `VEL-${year}-${seq}`;
  }

  async createTicket(
    userId: string,
    tenantId: string,
    dto: {
      category: string;
      subject: string;
      message: string;
      bookingId?: string;
      canteenOrderId?: string;
      tournamentRegistrationId?: string;
      priority?: string;
    },
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const ticket = await this.tickets.save({
      tenantId,
      userId,
      ticketNumber: await this.nextTicketNumber(),
      category: dto.category,
      subject: dto.subject.trim().slice(0, 300),
      status: 'open',
      priority: dto.priority ?? 'normal',
      bookingId: dto.bookingId ?? null,
      canteenOrderId: dto.canteenOrderId ?? null,
      tournamentRegistrationId: dto.tournamentRegistrationId ?? null,
      lastMessageAt: now,
    });

    await this.messages.save({
      ticketId: ticket.id,
      authorType: 'customer',
      authorUserId: userId,
      authorName: user.fullName,
      body: dto.message,
    });

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      bookingId: ticket.bookingId,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  async listTickets(
    userId: string,
    opts?: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
    const where: Record<string, unknown> = { userId };
    if (opts?.status?.trim()) where.status = opts.status.trim();

    const [rows, total] = await this.tickets.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        category: t.category,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        lastMessageAt: (t.lastMessageAt ?? t.updatedAt).toISOString(),
        createdAt: t.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async getTicket(userId: string, ticketId: string) {
    const ticket = await this.tickets.findOne({
      where: { id: ticketId },
      relations: ['messages'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) {
      throw new ForbiddenException('Not your ticket');
    }

    const msgs = (ticket.messages ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      bookingId: ticket.bookingId,
      messages: msgs.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  async addMessage(userId: string, ticketId: string, body: string) {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) {
      throw new ForbiddenException('Not your ticket');
    }

    const user = await this.users.findOne({ where: { id: userId } });
    const now = new Date();
    const msg = await this.messages.save({
      ticketId,
      authorType: 'customer',
      authorUserId: userId,
      authorName: user?.fullName ?? 'Customer',
      body: body.trim(),
    });

    ticket.lastMessageAt = now;
    ticket.updatedAt = now;
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      ticket.status = 'open';
    }
    await this.tickets.save(ticket);

    return {
      id: msg.id,
      ticketId,
      authorType: msg.authorType,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    };
  }
}
