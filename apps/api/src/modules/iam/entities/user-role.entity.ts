import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SystemRole } from '../iam.constants';
import { Role } from './role.entity';
import { User } from './user.entity';

@Entity({ name: 'user_roles' })
@Unique('uq_user_role', ['userId', 'roleCode'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 50 })
  roleCode!: SystemRole;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleCode', referencedColumnName: 'code' })
  role?: Role;

  @Column({ type: 'uuid', nullable: true })
  locationId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
