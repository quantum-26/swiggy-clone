// An in-memory stand-in for UserRepository. It implements the exact same
// method signatures (findByEmail, findById, create) that AuthService
// depends on - AuthService has no idea it isn't talking to Postgres.
// This is the Dependency Inversion payoff mentioned throughout the repo's
// comments: the repository was always injected via constructor, so
// swapping the real one for a fake one in tests requires zero changes to
// AuthService, AuthController, or the routes.
export class FakeUserRepository {
    constructor() {
        this.usersByEmail = new Map();
        this.usersById = new Map();
        this.nextId = 1;
    }

    async findByEmail(email) {
        return this.usersByEmail.get(email) || null;
    }

    async findById(id) {
        return this.usersById.get(id) || null;
    }

    async create({ email, passwordHash, name }) {
        const user = {
            id: `user-${this.nextId++}`,
            email,
            password_hash: passwordHash,
            name,
            created_at: new Date().toISOString(),
        };

        this.usersByEmail.set(email, user);
        this.usersById.set(user.id, user);

        // Mirrors the real repository's `RETURNING id, email, name, created_at`
        // - password_hash is deliberately never returned to a caller.
        return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
    }
}