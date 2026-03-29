import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../iam/entities/user.entity';
import { Business } from './business.entity';

export type MembershipRole = 'owner' | 'admin' | 'manager' | 'staff';

@Entity({ name: 'business_memberships' })
@Unique('uq_business_membership', ['businessId', 'userId'])
export class BusinessMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  businessId!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business?: Business;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 30 })
  membershipRole!: MembershipRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
