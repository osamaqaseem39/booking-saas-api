import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantTimeSlotTemplateLine } from './tenant-time-slot-template-line.entity';

@Entity({ name: 'tenant_time_slot_templates' })
export class TenantTimeSlotTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @OneToMany(() => TenantTimeSlotTemplateLine, (line) => line.template, {
    cascade: true,
  })
  slotLines!: TenantTimeSlotTemplateLine[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
