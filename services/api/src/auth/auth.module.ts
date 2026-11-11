import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CODE_DELIVERY, codeDeliveryFromEnv } from './code-delivery';
import { LoginCodeService } from './login-code.service';
import { jwtSecret } from '../env';

@Module({
  imports: [
    // Global: AuthGuard (registered below) and any future consumer verify
    // tokens with the same configuration.
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginCodeService,
    { provide: CODE_DELIVERY, useFactory: codeDeliveryFromEnv },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
