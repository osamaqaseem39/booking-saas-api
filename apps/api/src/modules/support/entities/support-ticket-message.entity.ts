import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';

@Entity({ name: 'support_ticket_messages' })
export class SupportTicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => SupportTicket, (t) => t.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket!: SupportTicket;

  @Column({ type: 'varchar', length: 16 })
  authorType!: string;

  @Column({ type: 'uuid', nullable: true })
  authorUserId?: string | null;

  @Column({ type: 'varchar', length: 200 })
  authorName!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
