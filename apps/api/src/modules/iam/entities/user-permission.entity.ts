import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'user_permissions' })
@Unique('uq_user_permission', ['userId', 'permissionKey'])
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  /** `${module}:${action}`, e.g. `bookings:edit`. */
  @Column({ type: 'varchar', length: 80 })
  permissionKey!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
