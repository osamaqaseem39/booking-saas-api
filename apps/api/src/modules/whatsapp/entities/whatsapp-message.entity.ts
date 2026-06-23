import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type WhatsappMessageDirection = 'inbound' | 'outbound';
export type WhatsappMessageDeliveryStatus = 'received' | 'pending' | 'sent' | 'failed';

@Entity({ name: 'whatsapp_messages' })
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'uuid' })
  channelId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 24 })
  customerWaId!: string;

  @Column({ type: 'varchar', length: 16 })
  direction!: WhatsappMessageDirection;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  externalMessageId?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'received' })
  deliveryStatus!: WhatsappMessageDeliveryStatus;

  @Column({ type: 'text', nullable: true })
  deliveryError?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
