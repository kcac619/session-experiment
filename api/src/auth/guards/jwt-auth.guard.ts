import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionService } from '../services/session.service';
import { Observable, from } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly sessionService: SessionService) {
    super();
  }

  override canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    return from(this.handleActivation(context));
  }

  private async handleActivation(context: ExecutionContext): Promise<boolean> {
    try {
      // First try with access token
      const canActivate = (await super.canActivate(context)) as boolean;
      if (canActivate) {
        return true;
      }
    } catch (err) {
      // Access token failed, try refresh token
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const refreshToken = request.cookies?.refreshToken;

      if (!refreshToken) {
        this.logger.warn('No refresh token found');
        throw new UnauthorizedException('No refresh token');
      }

      const result = await this.sessionService.refreshSession(refreshToken);
      if (!result) {
        this.logger.warn('Invalid or expired refresh token');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Set new access token cookie
      response.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.accessTokenExpiry,
      });

      // Update request with new access token for this request
      request.cookies.accessToken = result.accessToken;

      // Try again with new access token
      return (await super.canActivate(context)) as boolean;
    }

    return false;
  }
}
