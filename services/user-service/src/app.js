import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthRoutes } from './routes/authRoutes.js';

/*
    createApp is a pure factory: give it an already-wired authController
    (and, in production, pool/redisClient for the readiness probe) and it
    hands back a fully configured Express app that has never called
    .listen(). This split is what makes Supertest possible without a real
    server or a real Postgres/Redis connection: tests construct
    authController with FAKE repositories instead (see __tests__/helpers),
    and everything above the repository layer - routes, controller,
    service, JWT rotation logic, cookie handling - runs for real, exactly
    as it would in production.

    Before this refactor, all of this setup lived inline in index.js and
    called app.listen() in the same file, so there was no way to get an
    app instance into a test without also opening a real port and a real
    DB connection.
*/
export function createApp({ authController, pool, redisClient }) {
    const app = express();

    app.use(express.json());
    app.use(cookieParser());

    // --- Liveness: is the process even running? ---
    app.get('/health/live', (req, res) => {
        res.status(200).json({ status: 'ok', service: 'user-service' });
    });

    // --- Readiness: is the process ready for connection / can this instance actually serve traffic right now? ---
    app.get('/health/ready', async (req, res) => {
        if (!pool || !redisClient) {
            // Tests call createApp() without real infra - readiness isn't
            // a meaningful concept there, so just report ok rather than
            // forcing every test to fake a pool/redisClient it never uses.
            return res.status(200).json({ status: 'ready', note: 'no infra wired (test mode)' });
        }

        try {
            await pool.query('SELECT 1');
            await redisClient.ping();
            res.status(200).json({ status: 'ready', db: 'ok', redis: 'ok' });
        }
        catch (err) {
            res.status(503).json({ status: 'not-ready', error: err.message });
        }
    });

    app.get('/', (req, res) => {
        res.json({ message: 'user-service is alive' });
    });

    app.use('/auth', createAuthRoutes(authController));

    // Centralized error handler — must be defined LAST, after all routes
    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            error: { message: err.message || 'Internal server error' },
        });
    });

    return app;
}