import express from 'express';
import { createRestaurantRoutes } from './routes/restaurantRoutes.js';

/*
    Same split as user-service's app.js: createApp() never calls
    .listen(), never touches pool/redisClient directly except for the
    optional readiness check. Tests build restaurantController against a
    FakeRestaurantRepository and hand it here — everything from HTTP
    routing down through RestaurantService's business logic (page-size
    clamping, radius clamping, 404-on-missing-id) runs exactly as it does
    in production.
*/
export function createApp({ restaurantController, pool, redisClient }) {
    const app = express();

    app.use(express.json());

    app.get('/health/live', (req, res) => {
        res.status(200).json({ status: 'ok', service: 'restaurant-service' });
    });

    app.get('/health/ready', async (req, res) => {
        if (!pool || !redisClient) {
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
        res.json({ message: 'restaurant-service is alive' });
    });

    app.use('/restaurants', createRestaurantRoutes(restaurantController));

    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            error: { message: err.message || 'Internal server Error' },
        });
    });

    return app;
}