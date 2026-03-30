import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'businesses' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  businessName!: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  legalName?: string;

  @Column({ type: 'varchar', length: 80 })
  vertical!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
