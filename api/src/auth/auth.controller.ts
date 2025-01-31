import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenRefreshInterceptor } from './interceptors/token-refresh.interceptor';
import { SessionActivityInterceptor } from './interceptors/session-activity.interceptor';
import { AuthenticatedUser } from './types/auth.types';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
@UseInterceptors(TokenRefreshInterceptor, SessionActivityInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    const userAgent =
      typeof request.headers['user-agent'] === 'string'
        ? request.headers['user-agent']
        : 'unknown';
    const ipAddress = request.ip || '0.0.0.0';
    return this.authService.login(loginDto, response, userAgent, ipAddress);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response
  ) {
    return this.authService.logout(request.user.sessionId, response);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response
  ) {
    const { sub, sessionId } = request.user;
    return this.authService.logoutAllDevices(sub, sessionId, response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: RequestWithUser) {
    return {
      message: 'You are authenticated!',
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices')
  async getDevices(@Req() req: Request) {
    const user = req.user as any;
    return this.authService.getUserDevices(user.id);
  }
}
