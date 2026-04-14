import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TenantTimeSlotTemplate } from './tenant-time-slot-template.entity';

@Entity({ name: 'tenant_time_slot_template_lines' })
@Unique('UQ_tenant_time_slot_template_lines_template_start', ['templateId', 'startTime'])
export class TenantTimeSlotTemplateLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  templateId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status!: 'available' | 'blocked';

  @Column({ type: 'int' })
  sortOrder!: number;

  @ManyToOne(() => TenantTimeSlotTemplate, (template) => template.slotLines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template!: TenantTimeSlotTemplate;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
