// There is no Consul SDK doing anything magic here - the agent API is
// plain HTTP, and Node 20's built-in fetch is enough to talk to it.
// Registering a service is one PUT request; Consul then runs the HTTP
// health check we describe below on its own schedule (every 10s) and
// flips this service between "passing" and "critical" in its internal
// catalog. Anyone querying /v1/health/service/<name>?passing=true only
// ever sees instances currently passing - that's the actual mechanism
// the gateway relies on to avoid routing to a dead instance.

const CONSUL_URL = process.env.CONSUL_URL || 'http://consul:8500';

export async function registerService({
    id,
    name, 
    address, 
    port, 
    healthCheckPath = '/health/live'
}) {
    const payload = {
        ID: id,
        Name: name,
        Address: address,
        Port: port,
        Check: {
            HTTP: `http://${address}:${port}${healthCheckPath}`,
            Interval: '10s',
            Timeout: '2s',
            // If this instance's health check fails continuously for a
            // full minute, Consul removes the registration entirely
            // rather than leaving a permanently-critical entry around.
            DeregisterCriticalServiceAfter: '1m',
        },
    };

    const res = await fetch(`${CONSUL_URL}/v1/agent/service/register`,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Consul registration failed: ${res.status} ${await res.text()}`);
    }

    console.log(`[consul] registered "${name}" (id: ${id}) at ${address}:${port}`);
}

export async function deregisterService(id) {
    try {
        const res = await fetch(`${CONSUL_URL}/v1/agent/service/deregister/${id}`, {
            method: 'PUT',
        });

        if (!res.ok) {
            console.error(`[consul] deregister failed for ${id}: ${res.status}`);
        }
        else {
            console.log(`[consul] deregistered ${id}`);
        }
    }
    catch(err){
        // Don't let a failed deregister call block shutdown - the
        // DeregisterCriticalServiceAfter setting above is exactly the
        // safety net for this case (Consul will clean it up on its own
        // once health checks start failing).
        console.error(`[consul] deregister request errored for ${id}:`, err.message);
    }
}