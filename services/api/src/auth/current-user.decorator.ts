import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Principal attached to the request by AuthGuard after JWT verification. */
export interface AuthPrincipal {
  userId: string;
  username: string;
}

/** Injects the authenticated principal into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthPrincipal }>();
    return request.user;
  },
);
