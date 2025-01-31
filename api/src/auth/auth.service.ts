import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as _ from 'lodash';

import { User, Device } from '../app/entities';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Response } from 'express';
import { SessionService } from './services/session.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly sessionService: SessionService
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    await this.userRepository.save(user);
    return { message: 'User registered successfully' };
  }

  async login(
    loginDto: LoginDto,
    response: Response,
    userAgent: string,
    ipAddress: string
  ) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create new session
    const { accessToken, refreshToken, accessTokenExpiry, refreshTokenExpiry } =
      await this.sessionService.createSession(user, userAgent, ipAddress);

    // Set cookies
    response.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: accessTokenExpiry,
    });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: refreshTokenExpiry,
    });

    return { message: 'Logged in successfully' };
  }

  async logout(sessionId: string, response: Response) {
    await this.sessionService.deactivateSession(sessionId);

    response.clearCookie('accessToken');
    response.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  async logoutAllDevices(
    userId: string,
    currentSessionId: string,
    response: Response
  ) {
    await this.sessionService.deactivateAllUserSessions(
      userId,
      currentSessionId
    );
    return { message: 'Logged out from all other devices' };
  }

  async getUserDevices(userId: string) {
    const devices = await this.deviceRepository.find({
      where: {
        user: { id: userId },
        isActive: true,
      },
      relations: ['sessions'],
      order: {
        createdAt: 'DESC',
      },
    });

    return devices.map((device) => {
      const activeSessions = device.sessions.filter(
        (session) => session.isActive
      );
      const lastSession = _.maxBy(activeSessions, 'lastActivityAt');

      return {
        id: device.id,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        lastActivityAt: lastSession?.lastActivityAt || device.createdAt,
        activeSessions: activeSessions.length,
      };
    });
  }
}
