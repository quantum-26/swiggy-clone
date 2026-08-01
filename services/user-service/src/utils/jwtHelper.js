// Pure JWT sign/verify functions - no Express, no Redis, no class state.
// Pulling these out of AuthService is what makes "Jest unit tests for JWT
// helper functions" (today's Week 1 Day 5 goal) possible in the first
// place: you can now call signAccessToken() in a test with a throwaway
// secret and assert on the payload, without touching AuthService, a
// repository, or a database at all.

import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export function signAccessToken(user, accessSecret) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        accessSecret,
        {expiresIn: ACCESS_TOKEN_TTL}
    );
}

export function signRefreshToken({ userID, familyId, jti}, refreshSecret){
    return jwt.sign(
        { sub: userID, tokenType: 'refresh', familyId, jti},
        refreshSecret,
        {expiresIn: REFRESH_TOKEN_TTL}
    );
}

export function verifyAccessToken(token, accessSecret){
    // Deliberately a thin pass-through, not a try/catch swallow - callers
    // (AuthService, and the gateway's own verifyAccessToken middleware)
    // need the real jwt.verify errors (TokenExpiredError vs JsonWebTokenError)
    // to decide what status code / message to send back.
    return jwt.verify(token, accessSecret);
}

export function verifyRefreshToken(token, refreshSecret){
    return jwt.verify(token, refreshSecret);
}