export class UserRepository {
    constructor(pool) {

        // This is the Single Responsibility layer — it knows how to talk
        //  to Postgres and nothing about HTTP, passwords, or tokens. 
        // Two things worth naming explicitly:

        /* 
            1 - Parameterized queries ($1, $2, $3) — never string-concatenate user input into SQL. 
                This is the actual mechanism that prevents SQL injection; pg sends the query and values 
                separately to Postgres, so user input is never interpreted as SQL syntax.

            2 - Dependency injection of pool — the repository receives the connection pool via its constructor 
                rather than importing a global pool itself. This is what makes it testable: in a unit test, 
                you can pass in a fake/mock pool object instead of a real Postgres connection, without touching the class at all.
        */

        this.pool = pool;
    }


    async findByEmail(email) {
        const result = await this.pool.query(
            'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
            [email]
        );

        return result ? result.rows[0] : null;
    }

    async findById(id) {
        const result = await this.pool.query(
            'SELECT id, email, password_hash, name, created_at FROM users WHERE id = $1',
            [id]
        );

        return result ? result.rows[0] : null;
    }

    async create({
        email,
        passwordHash,
        name
    }) {
        const result = await this.pool.query(
            `INSERT INTO users (email, password_hash, name)
            VALUES ($1, $2, $3)
            RETURNING id, email, name, created_at
            `,
            [email, passwordHash, name]
        );
        return result.rows[0];
    }
}