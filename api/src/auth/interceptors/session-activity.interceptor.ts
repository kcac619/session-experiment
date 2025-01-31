import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SessionService } from '../services/session.service';
import { Request } from 'express';

@Injectable()
export class SessionActivityInterceptor implements NestInterceptor {
  constructor(private readonly sessionService: SessionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    // Only track activity for authenticated requests
    if (user?.sessionId) {
      return next.handle().pipe(
        tap(() => {
          // Update session activity asynchronously
          this.sessionService
            .updateSessionActivity(user.sessionId)
            .catch((error) => {
              console.error('Failed to update session activity:', error);
            });
        })
      );
    }

    return next.handle();
  }
}
