import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common';
import { User } from './user.entity';
import { Session } from './session.entity';

@Entity('devices')
export class Device extends BaseEntity {
  @Column({ type: 'varchar', length: 512 })
  userAgent!: string;

  @Column({ type: 'varchar', length: 45 }) // IPv6 length
  ipAddress!: string;

  @ManyToOne(() => User, (user) => user.devices)
  user!: User;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Session, (session) => session.device)
  sessions!: Session[];
}
