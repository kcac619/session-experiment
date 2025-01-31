import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, Session, User } from '../app/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenRefreshInterceptor } from './interceptors/token-refresh.interceptor';
import { SessionActivityInterceptor } from './interceptors/session-activity.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, Session]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
      signOptions: { expiresIn: '15m' }, // Default expiry for access tokens
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    JwtStrategy,
    JwtAuthGuard,
    TokenRefreshInterceptor,
    SessionActivityInterceptor,
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
