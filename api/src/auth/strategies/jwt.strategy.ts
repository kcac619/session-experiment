import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { User } from '../../app/entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from '../services/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly sessionService: SessionService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          this.logger.log(`Extracting JWT from request: ${request.cookies}`);
          return request?.cookies?.accessToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret',
    });
  }

  async validate(payload: { sub: string; sessionId: string }) {
    this.logger.log(`Validating JWT payload: ${JSON.stringify(payload)}`);

    // Validate session using session service
    const isValidSession = await this.sessionService.validateSession(
      payload.sessionId
    );
    if (!isValidSession) {
      this.logger.warn('Session not found or inactive');
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      this.logger.warn('User not found in database');
      throw new UnauthorizedException();
    }

    // Update session activity
    await this.sessionService.updateSessionActivity(payload.sessionId);

    this.logger.log(`User found in database: ${user.email}`);
    return { ...user, sessionId: payload.sessionId };
  }
}
