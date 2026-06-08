import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'whatsapp_processed_messages' })
export class WhatsappProcessedMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  messageId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
