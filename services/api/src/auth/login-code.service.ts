import { Inject, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  detectIdentifierType,
  normalizeEmail,
  normalizePhone,
  ERROR_CODES,
  type SendCodeResponseDto,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  tooManyRequestsException,
  unauthorizedException,
  unprocessableException,
} from '../shared/http-error';
import { CODE_DELIVERY, type CodeDelivery } from './code-delivery';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Email/phone verification-code login (M0 增强). Codes are persisted in
 * login_codes (D7): each send invalidates the destination's previous unused
 * codes, verification is capped at 5 attempts, and consumption is recorded
 * via consumedAt for auditability.
 */
@Injectable()
export class LoginCodeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CODE_DELIVERY) private readonly delivery: CodeDelivery,
  ) {}

  async send(identifierRaw: string): Promise<SendCodeResponseDto> {
    const { type, destination } = this.resolveDestination(identifierRaw);
    const user = await this.findUserByDestination(type, destination);
    // E42: never reveal whether the identifier is registered.
    if (!user) {
      return { sent: false, expiresInSec: CODE_TTL_MS / 1000 };
    }
    const latest = await this.prisma.loginCode.findFirst({
      where: { destination, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw tooManyRequestsException(
        ERROR_CODES.CODE_COOLDOWN,
        'please wait before requesting a new code',
      );
    }
    await this.prisma.loginCode.updateMany({
      where: { destination, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.loginCode.create({
      data: {
        channel: type.toUpperCase(),
        destination,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        userId: user.id,
      },
    });
    await this.delivery.send(type, destination, code);
    return {
      sent: true,
      expiresInSec: CODE_TTL_MS / 1000,
      ...(this.delivery.exposesCode ? { devCode: code } : {}),
    };
  }

  /** Resolves a destination + code to a user, or throws 401 INVALID_CODE (E40). */
  async verify(identifierRaw: string, code: string): Promise<User> {
    const { destination } = this.resolveDestination(identifierRaw);
    const record = await this.prisma.loginCode.findFirst({
      where: { destination, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const fail = () =>
      unauthorizedException(ERROR_CODES.INVALID_CODE, 'invalid or expired code');
    if (!record) throw fail();
    if (record.expiresAt.getTime() < Date.now()) throw fail();
    if (record.code !== code) {
      const attempts = record.attempts + 1;
      await this.prisma.loginCode.update({
        where: { id: record.id },
        data:
          attempts >= MAX_ATTEMPTS
            ? { attempts, consumedAt: new Date() }
            : { attempts },
      });
      throw fail();
    }
    await this.prisma.loginCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
  }

  private resolveDestination(identifierRaw: string): {
    type: 'email' | 'phone';
    destination: string;
  } {
    const type = detectIdentifierType(identifierRaw);
    if (type === 'username') {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'identifier must be an email or phone',
      );
    }
    const destination =
      type === 'email'
        ? normalizeEmail(identifierRaw)
        : normalizePhone(identifierRaw)!;
    return { type, destination };
  }

  private findUserByDestination(
    type: 'email' | 'phone',
    destination: string,
  ): Promise<User | null> {
    return type === 'email'
      ? this.prisma.user.findUnique({ where: { email: destination } })
      : this.prisma.user.findUnique({ where: { phone: destination } });
  }
}
