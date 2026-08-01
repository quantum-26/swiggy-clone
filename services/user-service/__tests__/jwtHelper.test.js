import jwt from 'jsonwebtoken'
import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
} from '../src/utils/jwtHelper.js'

// Throwaway secrets - never the real ones from .env. Using different
// strings for access vs refresh is deliberate: it's what lets the
// "not interchangeable" test below actually prove something.
const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';


describe('jwtHelper', () => {
    const user = { 
        id: 'user-123',
        email: 'alice@example.com'
    };

    test('signAccessToken produce  a token verifiable with the same secrt', () => {
        const token = signAccessToken(user, ACCESS_SECRET);
        const payload = verifyAccessToken(token, ACCESS_SECRET);

        expect(payload.sub).toBe(user.id);
        expect(payload.email).toBe(user.email);
    });

    test('verifyAccessToken through when the secret does not match', () => {
        const token = signAccessToken(user, ACCESS_SECRET);
        expect(() => verifyAccessToken(token, ACCESS_SECRET)).toThrow();
    });

    test('signRefreshToken embeds familyId, jti, and tokenType in the payload', () => {
        const familyId = 'family-abc';
        const jti = 'jti-xyz';

        const token = signRefreshToken({ userId: user.id, familyId, jti }, REFRESH_SECRET);
        const payload = verifyRefreshToken(token, REFRESH_SECRET);

        expect(payload.sub).toBe(user.id);
        expect(payload.familyId).toBe(familyId);
        expect(payload.jti).toBe(jti);
        expect(payload.tokenType).toBe('refresh');
    });

    test('an access token cannot be verified as a refresh token (different secrets)', () => {
        // This is the actual security boundary the gateway relies on:
        // even if someone got hold of an access token, it's useless
        // against anything that expects a refresh token, because it was
        // never signed with the refresh secret in the first place.
        const accessToken = signAccessToken(user, ACCESS_SECRET);
        expect(() => verifyRefreshToken(accessToken, REFRESH_SECRET)).toThrow();
    });

    test('an expired token fails verification with a TokenExpiredError', () => {
        // Sign directly with jsonwebtoken (not our helper) using a
        // negative expiresIn, so we get a token that's already expired
        // the instant it's created - no need to wait or fake timers.
        const expiredToken = jwt.sign({ sub: user.id }, ACCESS_SECRET, { expiresIn: -10 });

        expect(() => verifyAccessToken(expiredToken, ACCESS_SECRET)).toThrow(/jwt expired/i);
    });

    test('signAccessToken does not include tokenType (only refresh tokens are typed)', () => {
        // Small but real: the gateway's verifyAccessToken middleware trusts
        // any token that verifies against the access secret. If access
        // tokens ever accidentally carried tokenType: 'refresh', nothing
        // downstream would catch that confusion - so we pin the shape here.
        const token = signAccessToken(user, ACCESS_SECRET);
        const payload = verifyAccessToken(token, ACCESS_SECRET);
        expect(payload.tokenType).toBeUndefined();
    });

})