import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';

import 'dotenv/config';
import cookieParser from 'cookie-parser';

/*
This is the composition root — the one place in the whole service where concrete classes actually get instantiated 
and wired to each other. Everywhere else (AuthService, UserRepository, AuthController) only ever receives dependencies 
through its constructor; nothing else in the codebase does new UserRepository(...) except this file. 
This is what Dependency Inversion looks like in practice, not just in theory —
swapping Postgres for a different DB later would mean writing a new repository class and changing exactly one line here.
*/
import { UserRepository } from './src/repositories/userRepository.js';
import { RefereshTokenRespository } from './src/repositories/refreshTokenRepository.js';
import { AuthService } from './src/services/authService.js';
import { AuthController } from './src/controllers/authController.js';
import { createAuthRoutes } from './src/routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());


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

// --- Liveness: is the process even running? ---
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'user-service'
    });
});


// --- Readiness: is the process ready for connection / can this instance actually serve traffic right now? ---
app.get("/health/ready", async (req, res) => {
    try {
        await pool.query('SELECT 1');
        await redisClient.ping();
        res.status(200).json({
            status: 'ready',
            db: 'ok',
            redis: 'ok',
        });
    }
    catch (err) {
        res.status(503).json({
            status: 'not-ready', error: err.message
        });
    }
});



app.get('/', (req, res) => {
    res.json({
        message: 'user-service is alive'
    });
});

// define routes
app.use('/auth', createAuthRoutes(authController));

// Centralized error handler — must be defined LAST, after all routes
app.use((err, req, res, next) => {
    console.error(err);
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: {message: err.message || 'Internal server error'},
    })
})

const server = app.listen(PORT, () => {
    console.log(`user-service listening on port ${PORT}`);
})

// --- Graceful shutdown groundwork (built out fully in Week 6) ---
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down user-service...');
    server.close( async () => {
        await pool.end();
        await redisClient.quit();

        process.exit(0);
    })
})