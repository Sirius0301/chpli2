import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaService } from '../../src/shared/prisma.service';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
  setAuthToken,
} from '../helpers';

/**
 * Integration coverage of the M0 user & auth slice: registration, login,
 * token guard (E32), username conflict (E33), credential errors (E34/E37),
 * per-user isolation across calendar and travel modules (E35, A33-A35).
 */

interface AuthResult {
  token: string;
  userId: string;
  username: string;
}

let app: INestApplication;

async function register(username: string): Promise<AuthResult> {
  const res = await request(app.getHttpServer() as Express)
    .post('/api/auth/register')
    .send({ username, password: 'test-password-123' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { token: res.body.token, userId: res.body.user.id, username: res.body.user.username };
}

async function createCalendarFor(token: string, name: string): Promise<string> {
  const res = await request(app.getHttpServer() as Express)
    .post('/api/calendar/calendars')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, color: '#0A84FF', type: 'custom' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('registration and login', () => {
  it('registers, returns a token, and answers /me (A32)', async () => {
    const auth = await register('alice');
    expect(auth.token).toBeTruthy();
    const me = await request(app.getHttpServer() as Express)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auth.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: auth.userId, username: 'alice' });
  });

  it('rejects duplicate usernames case-insensitively (E33)', async () => {
    await register('Bob');
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'test-password-123' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('USERNAME_TAKEN');
  });

  it('rejects malformed credentials (E36)', async () => {
    const short = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'x', password: 'test-password-123' });
    expect(short.status).toBe(400);
    const weak = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'valid-name', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('logs in and returns the same identity', async () => {
    await register('carol');
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/login')
      .send({ identifier: 'carol', password: 'test-password-123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('carol');
    expect(res.body.token).toBeTruthy();
  });

  it('returns one error for wrong password and unknown user (E34)', async () => {
    await register('dave');
    for (const [identifier, password] of [
      ['dave', 'wrong-password'],
      ['no-such-user', 'test-password-123'],
    ] as const) {
      const res = await request(app.getHttpServer() as Express)
        .post('/api/auth/login')
        .send({ identifier, password });
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    }
  });
});

describe('email/phone + verification-code login (M0 增强)', () => {
  async function registerFull(
    username: string,
    extra: Record<string, string> = {},
  ): Promise<AuthResult> {
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username, password: 'test-password-123', ...extra });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return { token: res.body.token, userId: res.body.user.id, username: res.body.user.username };
  }

  it('logs in with bound email or phone + password (A36)', async () => {
    await registerFull('mallory', { email: 'Mallory@Example.com', phone: '138-0011-2233' });
    for (const identifier of ['mallory', 'mallory@example.com', '13800112233']) {
      const res = await request(app.getHttpServer() as Express)
        .post('/api/auth/login')
        .send({ identifier, password: 'test-password-123' });
      expect(res.status, identifier).toBe(200);
      expect(res.body.user.username).toBe('mallory');
    }
    const wrong = await request(app.getHttpServer() as Express)
      .post('/api/auth/login')
      .send({ identifier: 'mallory@example.com', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('exposes email/phone on registration and /me (A40)', async () => {
    const auth = await registerFull('nia', { email: 'nia@example.com', phone: '13900001111' });
    const me = await request(app.getHttpServer() as Express)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auth.token}`);
    expect(me.body).toMatchObject({ email: 'nia@example.com', phone: '13900001111' });
  });

  it('rejects already-bound email/phone with 409 (E38)', async () => {
    await registerFull('olaf', { email: 'shared@example.com', phone: '13700001111' });
    const emailTaken = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'olaf2', password: 'test-password-123', email: 'SHARED@example.com' });
    expect(emailTaken.status).toBe(409);
    expect(emailTaken.body.errorCode).toBe('EMAIL_TAKEN');
    const phoneTaken = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'olaf3', password: 'test-password-123', phone: '137-0000-1111' });
    expect(phoneTaken.status).toBe(409);
    expect(phoneTaken.body.errorCode).toBe('PHONE_TAKEN');
  });

  it('rejects malformed email/phone at registration (E39)', async () => {
    const badEmail = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'petra', password: 'test-password-123', email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    const badPhone = await request(app.getHttpServer() as Express)
      .post('/api/auth/register')
      .send({ username: 'petra2', password: 'test-password-123', phone: 'call-me' });
    expect(badPhone.status).toBe(400);
  });

  it('logs in via email verification code (A37)', async () => {
    await registerFull('quinn', { email: 'quinn@example.com' });
    const sent = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'quinn@example.com' });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ sent: true, expiresInSec: 600 });
    expect(sent.body.devCode).toMatch(/^[0-9]{6}$/);

    const loggedIn = await request(app.getHttpServer() as Express)
      .post('/api/auth/login-code')
      .send({ identifier: 'quinn@example.com', code: sent.body.devCode });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.username).toBe('quinn');
    expect(loggedIn.body.token).toBeTruthy();

    // The consumed code cannot be replayed (E40).
    const replay = await request(app.getHttpServer() as Express)
      .post('/api/auth/login-code')
      .send({ identifier: 'quinn@example.com', code: sent.body.devCode });
    expect(replay.status).toBe(401);
    expect(replay.body.errorCode).toBe('INVALID_CODE');
  });

  it('logs in via phone verification code', async () => {
    await registerFull('ruth', { phone: '13600001111' });
    const sent = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: '136 0000-1111' });
    expect(sent.status).toBe(200);
    expect(sent.body.devCode).toMatch(/^[0-9]{6}$/);
    const loggedIn = await request(app.getHttpServer() as Express)
      .post('/api/auth/login-code')
      .send({ identifier: '13600001111', code: sent.body.devCode });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.username).toBe('ruth');
  });

  it('rejects wrong codes and expires them after 5 attempts (E40)', async () => {
    await registerFull('sam', { email: 'sam@example.com' });
    const sent = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'sam@example.com' });
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer() as Express)
        .post('/api/auth/login-code')
        .send({ identifier: 'sam@example.com', code: '000000' });
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('INVALID_CODE');
    }
    // Code is burned after the 5th wrong attempt.
    const burned = await request(app.getHttpServer() as Express)
      .post('/api/auth/login-code')
      .send({ identifier: 'sam@example.com', code: sent.body.devCode });
    expect(burned.status).toBe(401);
  });

  it('rejects an expired code (E40)', async () => {
    await registerFull('tina', { email: 'tina@example.com' });
    const sent = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'tina@example.com' });
    const prisma = app.get(PrismaService);
    await prisma.loginCode.updateMany({
      where: { destination: 'tina@example.com', consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/login-code')
      .send({ identifier: 'tina@example.com', code: sent.body.devCode });
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INVALID_CODE');
  });

  it('enforces the resend cooldown (E41)', async () => {
    await registerFull('uma', { email: 'uma@example.com' });
    const first = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'uma@example.com' });
    expect(first.status).toBe(200);
    const second = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'uma@example.com' });
    expect(second.status).toBe(429);
    expect(second.body.errorCode).toBe('CODE_COOLDOWN');
  });

  it('returns sent:false for unbound identifiers without leaking (E42)', async () => {
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sent: false, expiresInSec: 600 });
    expect(res.body.devCode).toBeUndefined();
  });

  it('rejects username identifiers for code endpoints', async () => {
    const res = await request(app.getHttpServer() as Express)
      .post('/api/auth/code')
      .send({ identifier: 'just-a-username' });
    expect(res.status).toBe(422);
  });
});

describe('token guard', () => {
  it('rejects requests without a token (E32)', async () => {
    const res = await request(app.getHttpServer() as Express).get('/api/calendar/calendars');
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('UNAUTHORIZED');
  });

  it('rejects malformed and garbage tokens (E32)', async () => {
    const noBearer = await request(app.getHttpServer() as Express)
      .get('/api/calendar/calendars')
      .set('Authorization', 'Token abc');
    expect(noBearer.status).toBe(401);
    const garbage = await request(app.getHttpServer() as Express)
      .get('/api/calendar/calendars')
      .set('Authorization', 'Bearer not.a.token');
    expect(garbage.status).toBe(401);
  });
});

describe('per-user data isolation (E35)', () => {
  it('calendar lists, details, updates and deletes are scoped per user (A33)', async () => {
    const alice = await register('erin');
    const bob = await register('frank');

    const aliceCalendar = await createCalendarFor(alice.token, 'Erin private');
    // Bob cannot see Alice's calendar in his list.
    const bobList = await request(app.getHttpServer() as Express)
      .get('/api/calendar/calendars')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(
      (bobList.body as { id: string }[]).find((c) => c.id === aliceCalendar),
    ).toBeUndefined();

    // Bob gets 404 on every access pattern.
    const asBob = (method: 'get' | 'patch' | 'delete') =>
      request(app.getHttpServer() as Express)
        [method](`/api/calendar/calendars/${aliceCalendar}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send(method === 'patch' ? { name: 'hijacked' } : undefined);
    expect((await asBob('get')).status).toBe(404);
    expect((await asBob('patch')).status).toBe(404);
    expect((await asBob('delete')).status).toBe(404);

    // Alice's calendar is untouched.
    const aliceGet = await request(app.getHttpServer() as Express)
      .get(`/api/calendar/calendars`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(
      (aliceGet.body as { id: string; name: string }[]).find((c) => c.id === aliceCalendar)?.name,
    ).toBe('Erin private');
  });

  it('events are scoped through their calendar (E35)', async () => {
    const alice = await register('grace');
    const bob = await register('heidi');
    const calendarId = await createCalendarFor(alice.token, 'Grace cal');

    const created = await request(app.getHttpServer() as Express)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        id: '11111111-2222-4222-8222-333333333333',
        calendarId,
        title: 'Grace event',
        startAt: '2026-12-01T09:00:00.000Z',
        endAt: '2026-12-01T10:00:00.000Z',
      });
    expect(created.status).toBe(201);
    const eventId = created.body.id as string;

    // Bob cannot read, update, or delete Alice's event.
    for (const method of ['get', 'patch', 'delete'] as const) {
      const res = await request(app.getHttpServer() as Express)
        [method](`/api/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send(method === 'patch' ? { title: 'hijacked' } : undefined);
      expect(res.status).toBe(404);
    }
    // Bob cannot create into Alice's calendar either.
    const forged = await request(app.getHttpServer() as Express)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        id: '44444444-2222-4222-8222-555555555555',
        calendarId,
        title: 'forged',
        startAt: '2026-12-01T09:00:00.000Z',
        endAt: '2026-12-01T10:00:00.000Z',
      });
    expect(forged.status).toBe(404);
  });

  it('trips are scoped per user', async () => {
    const alice = await register('ivan');
    const bob = await register('judy');
    const created = await request(app.getHttpServer() as Express)
      .post('/api/travel/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Ivan trip', type: 'PLAN' });
    expect(created.status).toBe(201);
    const tripId = created.body.id as string;

    const bobGet = await request(app.getHttpServer() as Express)
      .get(`/api/travel/trips/${tripId}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobGet.status).toBe(404);

    const bobAdd = await request(app.getHttpServer() as Express)
      .post(`/api/travel/trips/${tripId}/transports`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        mode: 'TRAIN',
        origin: { level: 'COUNTRY', id: 'c1' },
        destination: { level: 'COUNTRY', id: 'c2' },
      });
    expect(bobAdd.status).toBe(404);
  });
});

describe('registration side effects (A35)', () => {
  it('a fresh user gets exactly one default custom calendar on first list', async () => {
    const auth = await register('kate');
    const res = await request(app.getHttpServer() as Express)
      .get('/api/calendar/calendars')
      .set('Authorization', `Bearer ${auth.token}`);
    expect(res.status).toBe(200);
    const calendars = res.body as { isDefault: boolean; type: string }[];
    expect(calendars).toHaveLength(1);
    expect(calendars[0]).toMatchObject({ isDefault: true, type: 'custom' });
  });
});

describe('helper-auth integration (regression guard)', () => {
  it('api() carries the default token so module suites stay authenticated', async () => {
    await registerTestUser(app, 'helper-tester');
    const res = await api(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('helper-tester');
    setAuthToken(null);
    const anonymous = await api(app).get('/api/auth/me');
    expect(anonymous.status).toBe(401);
  });
});
