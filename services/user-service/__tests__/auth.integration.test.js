import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/authService.js';
import { AuthController } from '../src/controllers/authController.js';
import { FakeUserRepository } from './helpers/fakeUserRepository.js';
import { FakeRefreshTokenRepository } from './helpers/fakeRefreshTokenRepository.js';

// Throwaway secrets for the test process only - never the real .env values.
const jwtConfig = {
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
};

/*
    buildTestApp wires the REAL AuthService and AuthController against
    FAKE repositories, then hands the result to the REAL createApp().
    Everything from the HTTP request down through routing, controller
    validation, bcrypt hashing, JWT signing, cookie attributes, and the
    refresh-token rotation/reuse-detection logic in AuthService runs
    exactly as it does in production. The only thing that's fake is the
    persistence boundary (Postgres/Redis) - which is precisely the
    boundary UserRepository/RefereshTokenRespository exist to isolate.
*/
function buildTestApp() {
    const userRepository = new FakeUserRepository();
    const refreshTokenRepository = new FakeRefreshTokenRepository();
    const authService = new AuthService(userRepository, jwtConfig, refreshTokenRepository);
    const authController = new AuthController(authService);
    return createApp({ authController });
}

// supertest exposes cookies as raw Set-Cookie header strings, e.g.
// "refreshToken=abc.def.ghi; Path=/; HttpOnly; SameSite=Strict".
// We only need the "name=value" part to send back as the next request's
// Cookie header - this pulls just that out.
function extractCookie(res, name) {
    const raw = res.headers['set-cookie'].find((c) => c.startsWith(`${name}=`));
    return raw.split(';')[0];
}

describe('Auth routes (integration - fake repositories, real HTTP + service layer)', () => {
    describe('POST /auth/signup', () => {
        test('creates a user and returns 201 without leaking the password hash', async () => {
            const app = buildTestApp();

            const res = await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });

            expect(res.status).toBe(201);
            expect(res.body.user.email).toBe('alice@example.com');
            expect(res.body.user.password_hash).toBeUndefined();
        });

        test('rejects a missing required field with 400', async () => {
            const app = buildTestApp();

            const res = await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123' }); // no name

            expect(res.status).toBe(400);
        });

        test('rejects a duplicate email with 409', async () => {
            const app = buildTestApp();
            const body = { email: 'alice@example.com', password: 'password123', name: 'Alice' };

            await request(app).post('/auth/signup').send(body);
            const res = await request(app).post('/auth/signup').send(body);

            expect(res.status).toBe(409);
        });
    });

    describe('POST /auth/login', () => {
        test('returns an access token in the body and sets an httpOnly refresh cookie', async () => {
            const app = buildTestApp();
            await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'alice@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.accessToken).toEqual(expect.any(String));
            // The refresh token must NEVER appear in the JSON body - it
            // only ever travels as an httpOnly cookie.
            expect(res.body.refreshToken).toBeUndefined();

            const cookies = res.headers['set-cookie'];
            expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
            expect(cookies.some((c) => /HttpOnly/i.test(c))).toBe(true);
        });

        test('rejects an incorrect password with 401', async () => {
            const app = buildTestApp();
            await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'alice@example.com', password: 'wrong-password' });

            expect(res.status).toBe(401);
        });

        test('rejects a non-existent email with 401 (not 404 - avoids leaking which emails exist)', async () => {
            const app = buildTestApp();

            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'nobody@example.com', password: 'password123' });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /auth/refresh', () => {
        test('rotates the refresh token and returns a fresh access token', async () => {
            const app = buildTestApp();
            await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });
            const loginRes = await request(app)
                .post('/auth/login')
                .send({ email: 'alice@example.com', password: 'password123' });

            const originalCookie = extractCookie(loginRes, 'refreshToken');

            const refreshRes = await request(app)
                .post('/auth/refresh')
                .set('Cookie', originalCookie);

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body.accessToken).toEqual(expect.any(String));

            const rotatedCookie = extractCookie(refreshRes, 'refreshToken');
            // Proves rotation actually happened - a new jti means a new
            // signed token string, even though it's the same user/family.
            expect(rotatedCookie).not.toBe(originalCookie);
        });

        test('rejects a request with no refresh cookie at all', async () => {
            const app = buildTestApp();
            const res = await request(app).post('/auth/refresh');
            expect(res.status).toBe(401);
        });

        test('detects reuse of an already-rotated refresh token and revokes the family', async () => {
            const app = buildTestApp();
            await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });
            const loginRes = await request(app)
                .post('/auth/login')
                .send({ email: 'alice@example.com', password: 'password123' });

            const originalCookie = extractCookie(loginRes, 'refreshToken');

            // Legitimate first refresh - rotates the family to a new jti.
            const firstRefresh = await request(app)
                .post('/auth/refresh')
                .set('Cookie', originalCookie);
            expect(firstRefresh.status).toBe(200);

            const rotatedCookie = extractCookie(firstRefresh, 'refreshToken');

            // Replay the now-stale ORIGINAL cookie - this is the theft/reuse path.
            const replayRes = await request(app)
                .post('/auth/refresh')
                .set('Cookie', originalCookie);
            expect(replayRes.status).toBe(401);

            // The whole family was just revoked as a precaution, so even
            // the token issued by the LEGITIMATE rotation above is now
            // dead too - this is the "both tabs get logged out" trade-off
            // documented in AuthService.
            const rotatedNowRejected = await request(app)
                .post('/auth/refresh')
                .set('Cookie', rotatedCookie);
            expect(rotatedNowRejected.status).toBe(401);
        });
    });

    describe('POST /auth/logout', () => {
        test('clears the cookie, returns 204, and revokes the family (refresh fails afterward)', async () => {
            const app = buildTestApp();
            await request(app)
                .post('/auth/signup')
                .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });
            const loginRes = await request(app)
                .post('/auth/login')
                .send({ email: 'alice@example.com', password: 'password123' });

            const cookie = extractCookie(loginRes, 'refreshToken');

            const logoutRes = await request(app)
                .post('/auth/logout')
                .set('Cookie', cookie);
            expect(logoutRes.status).toBe(204);

            const afterLogout = await request(app)
                .post('/auth/refresh')
                .set('Cookie', cookie);
            expect(afterLogout.status).toBe(401);
        });

        test('logout is idempotent - calling it with no cookie still returns 204', async () => {
            const app = buildTestApp();
            const res = await request(app).post('/auth/logout');
            expect(res.status).toBe(204);
        });
    });
});