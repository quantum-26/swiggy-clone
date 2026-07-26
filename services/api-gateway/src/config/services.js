// Centralizing service URLs in one place means when restaurant-service,
// order-service etc. implemented, this is the ONLY file
// that changes — the proxy setup and middleware don't need to know
// anything changed. This is what Open/Closed looks like for infra config,
// not just class design.

export const services = {
    /*
        Using the Docker Compose service name (user-service) as the hostname works because 
        Compose puts all services on the same bridge network with DNS resolution by service name
        — no hardcoded IPs, no Consul needed
    */
    user: process.env.USER_SERVICE_URL || 'http://user-service:400'
};
