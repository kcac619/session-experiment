import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;
}
