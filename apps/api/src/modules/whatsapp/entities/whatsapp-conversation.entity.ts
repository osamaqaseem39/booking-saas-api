import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WhatsappConversationStep =
  | 'menu'
  | 'pick_sport'
  | 'pick_date'
  | 'pick_slot'
  | 'confirm'
  | 'await_name';

export type WhatsappSlotOption = {
  courtKind: string;
  courtId: string;
  courtName: string;
  startTime: string;
  endTime: string;
  price: number;
};

export type WhatsappConversationState = {
  sport?: string;
  bookingDate?: string;
  slotOptions?: WhatsappSlotOption[];
  selectedSlot?: WhatsappSlotOption;
  customerName?: string;
};

@Entity({ name: 'whatsapp_conversations' })
export class WhatsappConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  channelId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 24 })
  customerWaId!: string;

  @Column({ type: 'varchar', length: 32, default: 'menu' })
  step!: WhatsappConversationStep;

  @Column({ type: 'jsonb', default: {} })
  state!: WhatsappConversationState;

  @Column({ type: 'timestamptz' })
  lastMessageAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
