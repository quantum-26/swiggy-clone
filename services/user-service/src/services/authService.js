// business logic, no HTTP, no SQL

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

/*
this is the bcrypt "cost factor." Each increment doubles the hashing time.
10 is a widely-used production default (roughly ~100ms per hash on typical hardware) 
— high enough to make brute-forcing expensive, low enough not to noticeably slow down your login endpoint
*/
const SAL_ROUNDS = 10;

export class AuthService {

    constructor(userRepository, jwtConfig, refreshTokenRepository) {

        /*
            The service never touches req/res — it takes plain objects in, returns plain objects out. 
            This is what makes it independent of Express; you could swap Express for Fastify later and this file wouldn't change at all.
        */
        this.userRepository = userRepository;
        this.jwtConfig = jwtConfig;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    async signUp({ email, password, name }){
        const existing = await this.userRepository.findByEmail(email);

        if(existing){
            const error = new Error('Email already registerd');
            error.statusCode = 409; // 409 Conflict is the correct HTTP status for "resource already exists"
            throw error;
        }

        const passwordHash = await bcrypt.hash(password, SAL_ROUNDS);
        const user = await this.userRepository.create({ email, passwordHash, name });

        return user;
    }

    /*
        #generateTokens as a private method (the # prefix) — this is native JS private class field/method syntax (ES2022). 
        It signals this is internal implementation detail, not part of AuthService's public contract — callers should only ever call signup() and login().
    */
    #generateTokens(user){

        /*
            the access token is what gets sent on every API request (in the Authorization header), 
            so it's designed to expire fast — if stolen, the damage window is small.
        */
        const accessToken = jwt.sign(
            {sub: user.id, email: user.email}, // this is a JWT standard claim name meaning "who this token is about."
            this.jwtConfig.accessSecret,
            {expiresIn: '15m'}
        );

        /*
            The refresh token lives longer but is only ever sent to one endpoint (/refresh) to mint new access tokens, 
            and stored in an httpOnly cookie, never accessible to JS, which limits XSS exposure.
        */
        const refreshToken = jwt.sign(
            { sub: user.id, tokenType: 'refresh'},
            this.jwtConfig.refreshSecret,
            { expiresIn: '7d'}
        )

        return { accessToken, refreshToken };
    }

    /*
        Now takes an optional familyId. Login always starts a NEW family
        (familyId = undefined → generate fresh). Rotation (from refresh())
        passes the EXISTING familyId through, since it's the same session
        continuing, just with new token instances.
    */
    async #issueTokenPair(user, familyId=randomUUID()) {
        const jti = randomUUID();

        const accessToken = jwt.sign(
            { sub: user.id, email: user.email},
            this.jwtConfig.accessSecret,
            {expiresIn: '15m'}
        );

        const refreshToken = jwt.sign(
            { sub: user.id, tokenType: 'refresh', familyId, jti },
            this.jwtConfig.refreshSecret,
            {expiresIn: '7d'}
        );

        return { accessToken, refreshToken, familyId, jti };
    }

    async login({ email, password }) {
        const user = await this.userRepository.findByEmail(email);

        if(!user){
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        /*
            never manually re-hash and compare strings —
            bcrypt's compare function handles extracting the salt from the stored hash and does a timing-safe comparison internally. 
            Never write bcrypt.hash(password) === user.password_hash yourself — that would generate a new salt and never match.
        */
        const isValid = await bcrypt.compare(password, user.password_hash);

        if(!isValid) {
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        // const tokens = this.#generateTokens(user);
        
        // Fresh family — this is a brand new session.
        const { accessToken, refreshToken, familyId, jti } = await this.#issueTokenPair(user);
        await this.refreshTokenRepository.createFamily(familyId, jti);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            accessToken,
            refreshToken,
        };
    }

    /*
        THE ROTATION FLOW — this is the [B] exercise's core logic.

        Steps, in order, and why each one exists:

        1. Verify signature + expiry via jwt.verify. If this throws,
        the token is either forged or genuinely expired — reject
        outright, no Redis lookup needed.

        2. Look up the family's CURRENT valid jti in Redis.
        - If the family doesn't exist at all (null), the session was
            already revoked (logout, or a previous theft response) or
            naturally expired. Reject.

        3. Compare the incoming token's jti against the stored jti.
        - MATCH: this is the legitimate, most-recent refresh token.
            Proceed to rotate.
        - MISMATCH: this token used to be valid but has since been
            rotated out. Someone is replaying an old token — this is
            exactly the theft scenario. We can't tell if it's the real
            user (e.g. a race from two tabs — see note below) or an
            attacker, so the safe move is to revoke the ENTIRE family.
            Both the legitimate user and the attacker get logged out;
            the user simply has to log in again. This is the standard,
            industry-accepted trade-off (Auth0, and the OAuth2 spec's
            refresh token rotation guidance, both work this way).

        4. On a genuine match: issue a new jti + new refresh token,
        advance the family in Redis to point at the new jti. The old
        jti is now permanently invalid — even the legitimate client
        can't use it again, which is exactly what makes replay
        detectable in the first place.

        One race condition worth knowing you're accepting: if a user has 
        the app open in two tabs and both fire a refresh at nearly the same instant,
        the second one to reach Redis will see a jti mismatch (the first one already rotated it) 
        and get treated as reuse — logging the user out of both tabs. This is a known, 
        accepted trade-off of strict rotation; production systems handle it with a short grace window 
        (allow the immediately previous jti to succeed once, within a few seconds) if this UX cost matters to you. 
        Not implementing that now — flagging it as a real thing to mention if an interviewer probes "what breaks under concurrent refresh calls."
    */
    async refresh(oldRefreshToken) {
        let payload;
        try {
            payload = jwt.verify(oldRefreshToken, this.jwtConfig.refreshSecret);
        }
        catch(err) {
            const error = new Error('Invalid or expired refresh token');
            error.statusCode = 401;
            throw error;
        }

        const { sub: userID, familyId, jti } = payload;

        const currentJti = await this.refreshTokenRepository.getCurrentJti(familyId);

        if(!currentJti) {
            const error = new Error('Session no longer valid - please log in again');
            error.statusCode = 401;
            throw error;
        }

        if(currentJti !== jti){
            // Reuse detected — nuke the whole family as a precaution.
            await this.refreshTokenRepository.revokeFamily(familyId);
            const error = new Error('Refresh token resue detected - session revoked');
            error.statusCode = 401;
            throw error;
        }

        // legitmate rotation.
        const freshUser = await this.userRepository.findById(userID);
        if(!freshUser){
            const error = new Error('User no longer exists');
            error.statusCode = 401;
            throw error;
        }

        const { accessToken, refreshToken, jti: newJti } = await this.#issueTokenPair(freshUser, familyId);

        await this.refreshTokenRepository.rotateJti(familyId, newJti);

        return { accessToken, refreshToken};
    }

    async logout(refreshToken) {
        try {
            const payload = jwt.verify(refreshToken, this.jwtConfig.refreshSecret);
            await this.refreshTokenRepository.revokeFamily(payload.familyId);
        }
        catch {
            // Already invalid/expired token — logout is idempotent either way,
            // nothing to revoke, and we don't want logout itself to ever 500.
        }
    }
}