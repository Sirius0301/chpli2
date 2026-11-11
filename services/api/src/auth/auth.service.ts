import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import {
  detectIdentifierType,
  normalizeEmail,
  normalizePhone,
  type AuthResponseDto,
  type SendCodeResponseDto,
  type UserDto,
} from '@chpli2/shared';
import { ERROR_CODES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { conflictException, unauthorizedException } from '../shared/http-error';
import { LoginCodeService } from './login-code.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(LoginCodeService) private readonly loginCodes: LoginCodeService,
  ) {}

  /**
   * Registers a new account. Usernames are stored as typed but uniqueness is
   * checked case-insensitively (E33); email/phone are normalized and must be
   * unbound (E38). A default calendar is provisioned lazily on the user's
   * first calendar list (A35).
   */
  async register(
    username: string,
    password: string,
    email?: string,
    phone?: string,
  ): Promise<AuthResponseDto> {
    const taken = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) {
      throw conflictException(ERROR_CODES.USERNAME_TAKEN, 'username is already taken');
    }
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    if (normalizedPhone === null && phone) {
      throw conflictException(ERROR_CODES.VALIDATION_ERROR, 'invalid phone');
    }
    if (normalizedEmail) {
      const bound = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (bound) {
        throw conflictException(ERROR_CODES.EMAIL_TAKEN, 'email is already bound');
      }
    }
    if (normalizedPhone) {
      const bound = await this.prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true },
      });
      if (bound) {
        throw conflictException(ERROR_CODES.PHONE_TAKEN, 'phone is already bound');
      }
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { username, passwordHash, email: normalizedEmail, phone: normalizedPhone },
    });
    return this.issueToken(user);
  }

  /**
   * Password login by username, email, or phone (D6). Unknown identifiers and
   * bad passwords produce the same error (E34); the bootstrap user
   * (passwordHash null) cannot log in this way (E37).
   */
  async login(identifier: string, password: string): Promise<AuthResponseDto> {
    const user = await this.findByIdentifier(identifier);
    const valid =
      user?.passwordHash != null && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !valid) {
      throw unauthorizedException(
        ERROR_CODES.INVALID_CREDENTIALS,
        'invalid identifier or password',
      );
    }
    return this.issueToken(user);
  }

  /** Verification-code login (E40-E42 live in LoginCodeService). */
  async loginWithCode(identifier: string, code: string): Promise<AuthResponseDto> {
    const user = await this.loginCodes.verify(identifier, code);
    return this.issueToken(user);
  }

  sendCode(identifier: string): Promise<SendCodeResponseDto> {
    return this.loginCodes.send(identifier);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw unauthorizedException(ERROR_CODES.UNAUTHORIZED, 'account no longer exists');
    }
    return this.toDto(user);
  }

  private async findByIdentifier(identifier: string): Promise<User | null> {
    const type = detectIdentifierType(identifier);
    if (type === 'email') {
      return this.prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } });
    }
    if (type === 'phone') {
      const phone = normalizePhone(identifier);
      return phone ? this.prisma.user.findUnique({ where: { phone } }) : null;
    }
    return this.prisma.user.findUnique({ where: { username: identifier.trim() } });
  }

  private issueToken(user: User): AuthResponseDto {
    return {
      token: this.jwt.sign({ sub: user.id, username: user.username }),
      user: this.toDto(user),
    };
  }

  private toDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
