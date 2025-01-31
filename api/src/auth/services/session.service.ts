import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Device, Session, User } from '../../app/entities';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly jwtService: JwtService
  ) {}

  async createSession(
    user: User,
    userAgent: string,
    ipAddress: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: Date;
    refreshTokenExpiry: Date;
  }> {
    // Find or create device
    let device = await this.deviceRepository.findOne({
      where: {
        userAgent,
        ipAddress,
        user: { id: user.id },
        isActive: true,
      },
    });

    if (!device) {
      device = this.deviceRepository.create({
        userAgent,
        ipAddress,
        user,
      });
      await this.deviceRepository.save(device);
    }

    // Create refresh token expiry
    const refreshTokenExpiry = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY);
    const accessTokenExpiry = new Date(Date.now() + this.ACCESS_TOKEN_EXPIRY);

    // Create session
    const session = this.sessionRepository.create({
      user,
      device,
      refreshTokenExpiresAt: refreshTokenExpiry,
      lastActivityAt: new Date(),
    });

    await this.sessionRepository.save(session);

    // Generate tokens
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        sessionId: session.id,
      },
      { expiresIn: '15m' }
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        sessionId: session.id,
        type: 'refresh',
      },
      { expiresIn: '24h' }
    );

    // Update session with refresh token
    session.refreshToken = refreshToken;
    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
    };
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session || !session.isActive) {
      return false;
    }

    // Check if session has been inactive for too long (15 minutes)
    const inactiveTime = Date.now() - session.lastActivityAt.getTime();
    if (inactiveTime > this.ACCESS_TOKEN_EXPIRY) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      return false;
    }

    return true;
  }

  async refreshSession(
    refreshToken: string
  ): Promise<{ accessToken: string; accessTokenExpiry: Date } | null> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken);
      if (payload.type !== 'refresh') {
        return null;
      }

      // Find session
      const session = await this.sessionRepository.findOne({
        where: {
          id: payload.sessionId,
          refreshToken,
          isActive: true,
        },
        relations: ['user'],
      });

      if (!session || session.refreshTokenExpiresAt < new Date()) {
        return null;
      }

      // Generate new access token
      const accessToken = this.jwtService.sign(
        {
          sub: session.user.id,
          sessionId: session.id,
        },
        { expiresIn: '15m' }
      );

      const accessTokenExpiry = new Date(Date.now() + this.ACCESS_TOKEN_EXPIRY);

      // Update last activity
      session.lastActivityAt = new Date();
      await this.sessionRepository.save(session);

      return { accessToken, accessTokenExpiry };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error refreshing session: ${error.message}`);
      } else {
        this.logger.error('Unknown error while refreshing session');
      }
      return null;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (session && session.isActive) {
      session.lastActivityAt = new Date();
      await this.sessionRepository.save(session);
    }
  }

  async deactivateSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (session) {
      session.isActive = false;
      await this.sessionRepository.save(session);
    }
  }

  async deactivateAllUserSessions(
    userId: string,
    exceptSessionId?: string
  ): Promise<void> {
    const query = this.sessionRepository
      .createQueryBuilder('session')
      .update(Session)
      .set({ isActive: false })
      .where('user.id = :userId', { userId });

    if (exceptSessionId) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await query.execute();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredSessions() {
    this.logger.log('Running expired sessions cleanup');
    const fifteenMinutesAgo = new Date(Date.now() - this.ACCESS_TOKEN_EXPIRY);

    try {
      const result = await this.sessionRepository.update(
        {
          isActive: true,
          lastActivityAt: LessThan(fifteenMinutesAgo),
        },
        {
          isActive: false,
        }
      );

      const affectedCount = result?.affected ?? 0;
      if (affectedCount > 0) {
        this.logger.log(`Deactivated ${affectedCount} expired sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }
}
