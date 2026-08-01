// In-memory stand-in for the Redis-backed RefereshTokenRespository.
// Same contract (createFamily/getCurrentJti/rotateJti/revokeFamily),
// backed by a plain Map instead of Redis - this is what lets the rotation
// and reuse-detection logic in AuthService get exercised for real in a
// test, with zero Redis dependency.
export class FakeRefreshTokenRepository {
    constructor() {
        this.families = new Map(); // familyId -> currentJti
    }

    async createFamily(familyId, jti) {
        this.families.set(familyId, jti);
    }

    async getCurrentJti(familyId) {
        return this.families.has(familyId) ? this.families.get(familyId) : null;
    }

    async rotateJti(familyId, newJti) {
        this.families.set(familyId, newJti);
    }

    async revokeFamily(familyId) {
        this.families.delete(familyId);
    }
}