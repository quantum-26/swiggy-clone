import { getHealthyInstances } from '../consul/resolveService.js';

const REFRESH_INTERVAL_MS = 5000;

// serviceName -> { instances: [{address, port}], nextIndex }
const registry = new Map();

async function refresh(serviceName) {
    try {
        const instances = await getHealthyInstances(serviceName);

        if (instances.length === 0) {
            console.warn(`[serviceRegistry] no passing instances for "${serviceName}" right now`);
        }

        // Preserve nextIndex across refreshes so round-robin doesn't reset
        // to instance 0 on every single poll - only the instance LIST changes.
        const existing = registry.get(serviceName);
        registry.set(serviceName, { instances, nextIndex: existing?.nextIndex || 0 });
    }
    catch (err) {
        // Deliberately keep serving the last-known-good instance list
        // rather than clearing the cache - a transient Consul blip
        // shouldn't take down routing for every request in flight until
        // the next successful refresh.
        console.error(`[serviceRegistry] refresh failed for "${serviceName}":`, err.message);
    }
}

/*
    Called once at gateway boot with the list of service names the
    gateway proxies to. Each name gets an immediate refresh (so routing
    works right away, not just after the first 5s tick) plus a recurring
    poll. This polling-with-cache approach - rather than hitting Consul on
    every incoming request - is the interview-relevant trade-off here:
    it bounds Consul's load to (number of services) requests every 5s no
    matter how much traffic the gateway itself handles, at the cost of up
    to ~5s of staleness if an instance goes down. For most services
    that's a fine trade; a payment-critical path might poll faster or
    push updates instead.
*/
export function startServiceRegistry(serviceNames) {
    serviceNames.forEach((name) => {
        refresh(name);
        setInterval(() => refresh(name), REFRESH_INTERVAL_MS);
    });
}

// Simple round-robin over whatever's currently cached. Throws if we've
// never successfully resolved this service even once - the proxy's
// onError handler turns that into an honest 502 rather than silently
// hanging or throwing an unhandled exception mid-request.
export function pickInstance(serviceName) {
    const entry = registry.get(serviceName);

    if (!entry || entry.instances.length === 0) {
        throw new Error(`No healthy instances registered for "${serviceName}"`);
    }

    const instance = entry.instances[entry.nextIndex % entry.instances.length];
    entry.nextIndex += 1;
    return instance;
}