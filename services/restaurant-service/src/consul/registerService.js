// Same pattern as user-service's src/consul/registerService.js. This is
// small enough (and infra-only, not business logic) that duplicating it
// across services rather than building a shared npm package is the right
// call for now - see the note in today's session about not
// over-abstracting a two-instance duplication. If a 3rd/4th service
// needs it verbatim, that's the signal to extract a tiny internal
// `@swiggy-clone/service-registry` package instead.

const CONSUL_URL = process.env.CONSUL_URL || 'http://consul:8500';

export async function registerService({ id, name, address, port, healthCheckPath = '/health/live' }) {
    const payload = {
        ID: id,
        Name: name,
        Address: address,
        Port: port,
        Check: {
            HTTP: `http://${address}:${port}${healthCheckPath}`,
            Interval: '10s',
            Timeout: '2s',
            DeregisterCriticalServiceAfter: '1m',
        },
    };

    const res = await fetch(`${CONSUL_URL}/v1/agent/service/register`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    catch (err) {
        console.error(`[consul] deregister request errored for ${id}:`, err.message);
    }
}