import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupportTicketMessage } from './support-ticket-message.entity';

@Entity({ name: 'support_tickets' })
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  ticketNumber!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: string;

  @Column({ type: 'varchar', length: 300 })
  subject!: string;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status!: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority!: string;

  @Column({ type: 'uuid', nullable: true })
  bookingId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  canteenOrderId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tournamentRegistrationId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date | null;

  @OneToMany(() => SupportTicketMessage, (m) => m.ticket, { cascade: true })
  messages!: SupportTicketMessage[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
