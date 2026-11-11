import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@chpli2/shared';
import { unauthorizedException } from '../shared/http-error';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthPrincipal } from './current-user.decorator';

interface TokenPayload {
  sub: string;
  username: string;
}

/**
 * Global guard (M0): every route requires `Authorization: Bearer <jwt>`
 * unless marked @Public(). Attaches the AuthPrincipal to the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthPrincipal }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw unauthorizedException(ERROR_CODES.UNAUTHORIZED, 'authentication required');
    }
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token);
      request.user = { userId: payload.sub, username: payload.username };
      return true;
    } catch {
      throw unauthorizedException(ERROR_CODES.UNAUTHORIZED, 'invalid or expired token');
    }
  }
}
