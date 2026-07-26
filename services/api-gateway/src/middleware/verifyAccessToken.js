import jwt from 'jsonwebtoken';

/*
    This middleware protects routes that require an authenticated user.
    Deliberately NOT applied to /auth/* (signup/login/refresh must be
    reachable without already having a token — that would be circular).

    Design decision worth being able to say out loud in an interview:
    the gateway only ever verifies the ACCESS token, and only needs the
    ACCESS secret to do it. It never sees the refresh secret. This is a
    real security boundary — even if the gateway were compromised, an
    attacker couldn't forge new sessions, only impersonate within the
    lifetime of a leaked access token (15 min).
*/
export function verifyAccessToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({
            error: {
                message: 'Missing or malformed Authorization header'
            }
        })
    }

    const token = authHeader.split(' ')[1];

    try{
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        // Attach decoded claims so downstream services (via proxy) can
        // trust req.user was already validated at the edge — this is the
        // core value proposition of an API gateway: auth happens once,
        // not re-implemented in every microservice.
        req.user = { id: payload.sub, email: payload.email};

        next();
    }
    catch(err){
        if(err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: { message: 'Access token expired '}});
        }

        return res.status(401).json({ error: { message: 'Invalid access token '}});
    }
}