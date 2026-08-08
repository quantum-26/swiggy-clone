import pg from 'pg';
import { createClient } from 'redis';
import 'dotenv/config';

import { RestaurantRepository } from './repositories/restaurantRepository.js';
import { RestaurantService } from './services/restaurantService.js';
import { RestaurantController } from './controllers/restaurantController.js';
import { createApp } from './app.js';
import { registerService, deregisterService } from './consul/registerService.js';

const PORT = process.env.PORT || 4000;
const SERVICE_ID = `restaurant-service-${PORT}`;

// DB pool create once , reused across request
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

// Redis Client
const redisClient = createClient({
    url: process.env.REDIS_URL,
});
redisClient.on('error', (err) => console.error('Redis client error:', err));
await redisClient.connect();

// define (repository → service → controller)
const restaurantRepository = new RestaurantRepository(pool);
const restaurantService = new RestaurantService(restaurantRepository);
const restaurantController = new RestaurantController(restaurantService);

const app = createApp({ restaurantController, pool, redisClient });

const server = app.listen(PORT, async () => {
    console.log(`restaurant-service listening on port ${PORT}`);

    try {
        await registerService({
            id: SERVICE_ID,
            name: 'restaurant-service',
            address: process.env.CONSUL_SERVICE_ADDRESS || 'restaurant-service',
            port: Number(PORT),
        });
    }
    catch (err) {
        console.error('[consul] registration failed:', err.message);
    }
});

// --- Graceful shutdown ---
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down restaurant-service...');
    await deregisterService(SERVICE_ID);
    server.close(async () => {
        await pool.end();
        await redisClient.quit();

        process.exit(0);
    });
});