import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import { Device, Session, User } from '../../app/entities';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ACCESS_TOKEN_EXPIRY = 20 * 1000; // 20 seconds
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
      relations: ['sessions'],
    });

    if (!device) {
      device = this.deviceRepository.create({
        userAgent,
        ipAddress,
        user,
      });
      await this.deviceRepository.save(device);
    }

    // Check for existing active session
    const existingSession = device.sessions?.find(
      (session) => session.isActive
    );
    if (existingSession) {
      // Deactivate old session
      existingSession.isActive = false;
      await this.sessionRepository.save(existingSession);
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
      { expiresIn: '20s' }
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
          // Don't check isActive here since we want to reactivate expired sessions
        },
        relations: ['user', 'device'],
      });

      // If refresh token is expired or session not found, return null
      if (!session || session.refreshTokenExpiresAt < new Date()) {
        return null;
      }

      // Reactivate session if it was inactive
      if (!session.isActive) {
        session.isActive = true;
      }

      // Generate new access token
      const accessToken = this.jwtService.sign(
        {
          sub: session.user.id,
          sessionId: session.id,
        },
        { expiresIn: '20s' }
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

  @Cron('*/30 * * * * *') // Run every 30 seconds
  async cleanupExpiredSessions() {
    this.logger.log('Running expired sessions cleanup');
    const twentySecondsAgo = new Date(Date.now() - this.ACCESS_TOKEN_EXPIRY);

    try {
      const result = await this.sessionRepository.update(
        {
          isActive: true,
          lastActivityAt: LessThan(twentySecondsAgo),
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
