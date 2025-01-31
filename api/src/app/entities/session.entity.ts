import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common';
import { User } from './user.entity';
import { Device } from './device.entity';

@Entity('sessions')
export class Session extends BaseEntity {
  @ManyToOne(() => User, (user) => user.sessions)
  user!: User;

  @ManyToOne(() => Device, (device) => device.sessions)
  device!: Device;

  @Column({ type: 'varchar', length: 512, nullable: true })
  refreshToken!: string;

  @Column({ type: 'timestamp' })
  refreshTokenExpiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
