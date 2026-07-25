import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());


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