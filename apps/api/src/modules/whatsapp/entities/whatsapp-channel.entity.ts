import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WhatsappChannelStatus =
  | 'pending'
  | 'connected'
  | 'paused'
  | 'error'
  | 'disconnected';

export type WhatsappChannelProvider = 'meta' | 'openwa';

@Entity({ name: 'whatsapp_channels' })
export class WhatsappChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  locationId?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'meta' })
  provider!: WhatsappChannelProvider;

  @Column({ type: 'varchar', length: 64, unique: true })
  phoneNumberId!: string;

  @Column({ type: 'varchar', length: 32 })
  displayNumber!: string;

  @Column({ type: 'varchar', length: 64 })
  wabaId!: string;

  @Column({ type: 'text' })
  accessToken!: string;

  @Column({ type: 'varchar', length: 24, default: 'connected' })
  status!: WhatsappChannelStatus;

  @Column({ type: 'boolean', default: true })
  botEnabled!: boolean;

  @Column({ type: 'text', nullable: true })
  greetingMessage?: string | null;

  @Column({ type: 'uuid', nullable: true })
  defaultLocationId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastWebhookAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
