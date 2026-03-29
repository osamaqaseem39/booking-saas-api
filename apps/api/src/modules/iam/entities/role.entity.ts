import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { SystemRole } from '../iam.constants';

@Entity({ name: 'roles' })
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code!: SystemRole;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
