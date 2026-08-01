import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';
import 'dotenv/config';

import { RestaurantRepository } from './repositories/restaurantRepository.js';
import { RestaurantService } from './services/restaurantService.js';
import { RestaurantController } from './controllers/restaurantController.js';
import { createRestaurantRoutes } from './routes/restaurantRoutes.js';
import { registerService, deregisterService } from './consul/registerService.js';

const app = express();
const PORT = process.env.PORT || 4000;
const SERVICE_ID = `restaurant-service-${PORT}`;

app.use(express.json());


// DB pool create once , reused across request
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
})

// Redis Client
const redisClient = createClient({
    url: process.env.REDIS_URL
})
redisClient.on('error', (err) => console.error('Redis client error:', err));
await redisClient.connect();

// Setup
const restaurantRespository = new RestaurantRepository(pool);
const restaurantService = new RestaurantService(restaurantRespository);
const restaurantController = new RestaurantController(restaurantService);


// --- Liveness: is the process even running? ---
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'restaurant-service'
    });
});


// --- Readiness: is the process ready for connection / can this instance actually serve traffic right now? ---
// (was '/healthy/ready' - fixed to '/health/ready' to match user-service
// and api-gateway; Consul/monitoring conventions only work if every
// service exposes the same path shape.)
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
        message: 'restaurant-service is alive'
    });
});

app.use('/restaurants', createRestaurantRoutes(restaurantController));

app.use((err, req, res, next) => {
    console.log(err);
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: { message: err.message || 'Internal server Error'},
    });
});

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
})

// --- Graceful shutdown ---
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down restaurant-service...');
    await deregisterService(SERVICE_ID);
    server.close( async () => {
        await pool.end();
        await redisClient.quit();

        process.exit(0);
    })
})