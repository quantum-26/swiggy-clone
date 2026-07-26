/*
    A "family" represents one continuous login session. It starts at
    login with a fresh familyId (uuid) and survives across N rotations —
    the familyId never changes, only the jti (the specific token
    instance) does, every time /refresh is called.

    Redis key: refresh:family:<familyId>  →  value: current valid jti
    TTL: matches the refresh token's own expiry (7d), reset on each
    rotation (sliding session — see notes on this trade-off below).

    Storing ONLY the current valid jti (not a full token) means Redis
    holds no secrets — even if Redis were dumped, there's nothing here
    an attacker could replay directly; jti is a random UUID, meaningless
    without a validly-signed JWT that references it.
*/

const FAMILY_TTL_SECONDS = 7 * 24 * 60 * 60 ; // 7 days

export class RefereshTokenRespository {
    constructor(redisClient) {
        this.redis = redisClient;
    }

    #familyKey(familyId) {
        return `refresh:family:${familyId}`;
    }

    // Called once at login — establishes a brand new session family.
    async createFamily(familyId, jti) {
        await this.redis.set(this.#familyKey(familyId), jti, {
            EX: FAMILY_TTL_SECONDS,
        })
    }

    // Returns the currently-valid jti for a family, or null if the
    // family doesn't exist (expired naturally, or was revoked).
    async getCurrentJti(familyId) {
        return this.redis.get(this.#familyKey(familyId));
    }
    
    // Called on every successful rotation — advances the family to a
    // new jti and resets the TTL clock (sliding expiry).
    async rotateJti(familyId, newJti) {
        await this.redis.set(this.#familyKey(familyId), newJti, {
            EX: FAMILY_TTL_SECONDS,
        })

        /*
            The alternative (absolute expiry: store the original login timestamp, 
            cap total session life at, say, 30 days regardless of activity) is 
            what you'd want for something like a banking session. If an interviewer 
            asks "how would you cap this," the answer is: store createdAt alongside the jti, 
            and reject rotation once now - createdAt > absoluteMax, even if the jti still matches.
        */
    }

    // Called on logout OR on detected token reuse (theft response) —
    // deletes the family entirely, immediately invalidating every
    // refresh token that was ever part of this session.
    async revokeFamily(familyId) {
        await this.redis.del(this.#familyKey(familyId));
    }
}