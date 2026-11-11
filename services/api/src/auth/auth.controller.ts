import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthResponseDto, SendCodeResponseDto, UserDto } from '@chpli2/shared';
import { ValidatedBody } from '../shared/validate-dto';
import { AuthService } from './auth.service';
import { LoginCodeBody, LoginBody, RegisterBody, SendCodeBody } from './auth.dto';
import { Public } from './public.decorator';
import { CurrentUser, type AuthPrincipal } from './current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ description: 'Account created; bearer token issued.' })
  register(@ValidatedBody(RegisterBody) body: RegisterBody): Promise<AuthResponseDto> {
    return this.auth.register(
      body.username.trim(),
      body.password,
      body.email?.trim() || undefined,
      body.phone?.trim() || undefined,
    );
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Bearer token issued.' })
  login(@ValidatedBody(LoginBody) body: LoginBody): Promise<AuthResponseDto> {
    return this.auth.login(body.identifier.trim(), body.password);
  }

  @Public()
  @Post('code')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Login verification code sent (email/phone).' })
  sendCode(@ValidatedBody(SendCodeBody) body: SendCodeBody): Promise<SendCodeResponseDto> {
    return this.auth.sendCode(body.identifier.trim());
  }

  @Public()
  @Post('login-code')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Bearer token issued after code verification.' })
  loginWithCode(@ValidatedBody(LoginCodeBody) body: LoginCodeBody): Promise<AuthResponseDto> {
    return this.auth.loginWithCode(body.identifier.trim(), body.code.trim());
  }

  @Get('me')
  @ApiOkResponse({ description: 'The authenticated user.' })
  me(@CurrentUser() principal: AuthPrincipal): Promise<UserDto> {
    return this.auth.me(principal.userId);
  }
}
