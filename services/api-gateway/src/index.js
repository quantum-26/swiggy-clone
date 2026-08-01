import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { errorHandler } from './middleware/errorHandler.js';
import { startServiceRegistry, pickInstance } from './config/serviceRegistry.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cookieParser());
/*
    IMPORTANT: do NOT app.use(express.json()) globally before the proxy.
    If you parse and re-serialize the body here, http-proxy-middleware
    has to re-stringify it to forward it on, and subtle bugs creep in
    (wrong Content-Length, lost raw body for things like webhook
    signature verification later). The gateway's job is to pass bytes
    through untouched for proxied routes; JSON parsing belongs in the
    downstream service that actually needs the parsed object.
*/

// Start polling Consul for these two services right away, before the
// server even starts accepting requests. Both proxy routes below read
// from this in-memory cache synchronously on every request - they never
// call Consul inline in the request path, which is what keeps proxy
// latency independent of Consul's own latency/availability.
startServiceRegistry(['user-service', 'restaurant-service']);

app.get('/health/live', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

app.get('/health/ready', (req, res) => {
    // Gateway itself has no DB/Redis dependency of its own (yet), so
    // readiness = liveness for now. This will change if we add
    // gateway-level rate limiting backed by Redis.
    res.status(200).json({ status: 'ready' });
});

/*
    buildProxy replaces the old static `target: services.user` config.
    `router` is invoked by http-proxy-middleware synchronously on every
    incoming request and must return the target origin - we satisfy that
    by reading the already-refreshed serviceRegistry cache (pickInstance),
    never by calling Consul inline mid-request.
*/
function buildProxy(serviceName) {
    return createProxyMiddleware({
        changeOrigin: true,
        router: (req) => {
            const { address, port } = pickInstance(serviceName);
            return `http://${address}:${port}`;
        },
        onError: (err, req, res) => {
            console.error(`Proxy error -> ${serviceName}:`, err.message);
            res.status(502).json({
                error: { message: `${serviceName} unavailable` },
            });
        },
    });
}

/*
    Auth routes are proxied WITHOUT verifyAccessToken — signup, login,
    and refresh all happen before a valid access token exists.
    pathRewrite is not used: we want /auth/signup on the gateway to map
    to /auth/signup on user-service 1:1, so the public API surface and
    the internal service routes stay identical. Keeps mental mapping simple.
*/
app.use('/auth', buildProxy('user-service'));

/*
    Restaurant browsing is deliberately public - no verifyAccessToken
    here. Browsing a food delivery app's restaurant list has never
    required being logged in in any real product (Swiggy, Zomato, etc.);
    login only gates checkout. verifyAccessToken gets reintroduced in
    front of order-service in Week 3, and selectively in front of any
    admin-only restaurant-service routes once the admin dashboard exists
    in Week 5.
*/
app.use('/restaurants', buildProxy('restaurant-service'));

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`api-gateway listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down api-gateway');
    server.close(() => process.exit(0));
});