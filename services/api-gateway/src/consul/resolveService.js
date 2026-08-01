// The other half of the Consul story: user-service and restaurant-service
// each PUT themselves into Consul's catalog on startup (see their
// src/consul/registerService.js). This file is how the gateway asks
// Consul "who is currently healthy for this service name?" - a single
// GET against Consul's HTTP health API, with ?passing=true meaning
// "only give me instances whose health check is currently green."

const CONSUL_URL = process.env.CONSUL_URL || 'http://consul:8500';

export async function getHealthyInstances(serviceName) {
    const res = await fetch(`${CONSUL_URL}/v1/health/service/${serviceName}?passing=true`);

    if (!res.ok) {
        throw new Error(`Consul health query for "${serviceName}" failed: ${res.status}`);
    }

    const entries = await res.json();

    // Each entry looks roughly like { Service: { Address, Port, ... }, Checks: [...] }.
    // We only need Address/Port to build a proxy target.
    return entries.map((entry) => ({
        address: entry.Service.Address,
        port: entry.Service.Port,
    }));
}