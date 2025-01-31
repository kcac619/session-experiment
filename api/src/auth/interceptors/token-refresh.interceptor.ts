import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SessionService } from '../services/session.service';
import { Request, Response } from 'express';

@Injectable()
export class TokenRefreshInterceptor implements NestInterceptor {
  constructor(private readonly sessionService: SessionService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const accessToken = request.cookies['accessToken'];
    const refreshToken = request.cookies['refreshToken'];

    if (!accessToken && refreshToken) {
      const result = await this.sessionService.refreshSession(refreshToken);

      if (result) {
        // Set new access token cookie
        response.cookie('accessToken', result.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: result.accessTokenExpiry,
        });
      } else {
        // Clear both tokens if refresh failed
        response.clearCookie('accessToken');
        response.clearCookie('refreshToken');
        throw new UnauthorizedException('Session expired');
      }
    }

    return next.handle();
  }
}
