import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common';
import { Exclude } from 'class-transformer';
import { Device } from './device.entity';
import { Session } from './session.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password!: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @OneToMany(() => Device, (device) => device.user)
  devices!: Device[];

  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];
}
