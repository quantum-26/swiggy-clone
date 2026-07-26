import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { verifyAccessToken } from './src/middleware/verifyAccessToken.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { services } from './src/config/services.js';


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
    Auth routes are proxied WITHOUT verifyAccessToken — signup, login,
    and refresh all happen before a valid access token exists.
    pathRewrite is not used: we want /auth/signup on the gateway to map
    to /auth/signup on user-service 1:1, so the public API surface and
    the internal service routes stay identical. Keeps mental mapping simple.
*/
app.use('/auth', createProxyMiddleware({
    target: services.user,
    changeOrigin: true,
    onError: (err, req, res) => {
        console.error('Proxy error -> user-service : ', err.message);
        res.status(502).json({
            error: {
                message: 'user-service unavailable'
            }
        });
    },
}))

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`api-gateway listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down api-gateway');
    server.close(() => process.exit(0));
});