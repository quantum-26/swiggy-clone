import pg from 'pg';
import { createClient } from 'redis';
import 'dotenv/config';

/*
This is the composition root — the one place in the whole service where concrete classes actually get instantiated 
and wired to each other. Everywhere else (AuthService, UserRepository, AuthController) only ever receives dependencies 
through its constructor; nothing else in the codebase does new UserRepository(...) except this file. 
This is what Dependency Inversion looks like in practice, not just in theory —
swapping Postgres for a different DB later would mean writing a new repository class and changing exactly one line here.

index.js itself is now deliberately thin: it wires real infra (pg.Pool,
redis client) and hands off to createApp() for everything HTTP-shaped.
app.js has no idea whether it's running against real Postgres/Redis or
the fakes __tests__/ hands it - that boundary is exactly what Day 5's
Supertest tests exploit.

*/
import { UserRepository } from './repositories/userRepository.js';
import { RefereshTokenRespository } from './repositories/refreshTokenRepository.js';
import { AuthService } from './services/authService.js';
import { AuthController } from './controllers/authController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createApp } from './app.js';
import { registerService, deregisterService } from './consul/registerService.js';

const PORT = process.env.PORT || 4000;

// Unique per-process id Consul uses to identify THIS instance. Using the
// port keeps it unique even if you later run multiple user-service
// containers side by side on different host ports.
const SERVICE_ID = `user-service-${PORT}`;


// DB pool create once , reused across request
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
})

// Redis Client
const redisClient = createClient({
    url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis client error:', err));
await redisClient.connect();

// JWTConfig
const jwtConfig = {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
}

// define (repository → service → controller → routes.)
const userRepository = new UserRepository(pool);
const refreshTokenRepository = new RefereshTokenRespository(redisClient);
const authService = new AuthService(userRepository, jwtConfig, refreshTokenRepository);
const authController = new AuthController(authService);

const app = createApp({ authController, pool, redisClient});

const server = app.listen(PORT, async() => {
    console.log(`user-service listening on port ${PORT}`);

    try{
        await registerService({
            id: SERVICE_ID,
            name: 'user-service',
            // CONSUL_SERVICE_ADDRESS is set to the Docker Compose service
            // name ("user-service"). Compose's embedded DNS resolves that
            // name to whichever container is currently running it, which
            // is what lets the gateway proxy to "http://user-service:4000"
            // and have it work regardless of which container instance
            // that resolves to.
            address: process.env.CONSUL_SERVICE_ADDRESS || 'user-service',
            port: Number(PORT),
        });
    }
    catch(err){
        // Registration failing shouldn't crash the whole service - it can
        // still serve traffic directly (e.g. curl straight to :4001 on the
        // host). It just won't be reachable through the gateway's dynamic
        // routing until this is fixed, so log loudly.
        console.error('[consul] registration failed:', err.message);
    }
})

// --- Graceful shutdown groundwork (built out fully in Week 6) ---
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down user-service...');
    await deregisterService(SERVICE_ID);
    server.close( async () => {
        await pool.end();
        await redisClient.quit();

        process.exit(0);
    })
})