import request from 'supertest';
import { createApp } from '../src/app.js';
import { RestaurantService } from '../src/services/restaurantService.js';
import { RestaurantController } from '../src/controllers/restaurantController.js';
import { FakeRestaurantRepository } from './helpers/fakeRestaurantRepository.js';

const CENTER_LAT = 12.9716;
const CENTER_LNG = 77.5946;

const seedRestaurants = [
    { id: 'r1', name: 'Pizza Palace', cuisine: 'Italian', latitude: CENTER_LAT + 0.001, longitude: CENTER_LNG + 0.001, rating: 4.5, price_range: 3, is_open: true },
    { id: 'r2', name: 'Sushi Spot', cuisine: 'Japanese', latitude: CENTER_LAT + 0.002, longitude: CENTER_LNG - 0.001, rating: 4.2, price_range: 4, is_open: true },
    // deliberately far away — proves the radius filter genuinely excludes
    // it, not just that the endpoint returns SOMETHING
    { id: 'r3', name: 'Faraway Diner', cuisine: 'Continental', latitude: CENTER_LAT + 5, longitude: CENTER_LNG + 5, rating: 4.0, price_range: 2, is_open: true },
    { id: 'r4', name: 'Closed Kitchen', cuisine: 'Italian', latitude: CENTER_LAT, longitude: CENTER_LNG, rating: 4.8, price_range: 2, is_open: false },
];

function buildTestApp() {
    const restaurantRepository = new FakeRestaurantRepository(seedRestaurants, {
        r1: [{ id: 'm1', name: 'Margherita', description: 'Classic', price: 300, is_veg: true, is_available: true }],
    });
    const restaurantService = new RestaurantService(restaurantRepository);
    const restaurantController = new RestaurantController(restaurantService);
    return createApp({ restaurantController });
}

describe('Restaurant routes (integration - fake repository, real HTTP + service layer)', () => {
    describe('GET /restaurants', () => {
        test('returns the full seeded list with default paging', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants');

            expect(res.status).toBe(200);
            expect(res.body.restaurants).toHaveLength(4);
        });

        test('filters by search term (case-insensitive substring)', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants?search=pizza');

            expect(res.status).toBe(200);
            expect(res.body.restaurants).toHaveLength(1);
            expect(res.body.restaurants[0].id).toBe('r1');
        });

        test('filters by cuisine', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants?cuisine=Italian');

            expect(res.status).toBe(200);
            expect(res.body.restaurants.map((r) => r.id).sort()).toEqual(['r1', 'r4']);
        });
    });

    describe('GET /restaurants/:id', () => {
        test('returns the restaurant with its menu items', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants/r1');

            expect(res.status).toBe(200);
            expect(res.body.restaurant.id).toBe('r1');
            expect(res.body.restaurant.menuItems).toHaveLength(1);
        });

        test('returns 404 for an unknown id', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants/does-not-exist');

            expect(res.status).toBe(404);
        });
    });

    describe('GET /restaurants/nearby', () => {
        test('is NOT shadowed by the /:id route — the route-ordering regression test', async () => {
            // Before today's routes.js fix, GET /restaurants/nearby matched
            // /:id with id="nearby", called getRestaurantWithMenu("nearby"),
            // and 404'd. This test locks the fix in place: if someone
            // reorders the routes back later, this fails immediately
            // instead of the bug resurfacing silently weeks from now.
            const app = buildTestApp();
            const res = await request(app).get(`/restaurants/nearby?lat=${CENTER_LAT}&lng=${CENTER_LNG}&radiusKm=5`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('center');
            expect(res.body).toHaveProperty('radiusKm');
        });

        test('excludes restaurants outside the radius', async () => {
            const app = buildTestApp();
            const res = await request(app).get(`/restaurants/nearby?lat=${CENTER_LAT}&lng=${CENTER_LNG}&radiusKm=5`);

            const ids = res.body.restaurants.map((r) => r.id);
            expect(ids).not.toContain('r3');
        });

        test('excludes closed restaurants', async () => {
            const app = buildTestApp();
            const res = await request(app).get(`/restaurants/nearby?lat=${CENTER_LAT}&lng=${CENTER_LNG}&radiusKm=5`);

            const ids = res.body.restaurants.map((r) => r.id);
            expect(ids).not.toContain('r4');
        });

        test('sorts nearest-first', async () => {
            const app = buildTestApp();
            const res = await request(app).get(`/restaurants/nearby?lat=${CENTER_LAT}&lng=${CENTER_LNG}&radiusKm=5`);

            expect(res.body.restaurants[0].id).toBe('r1');
        });

        test('rejects a request with no lat/lng with 400', async () => {
            const app = buildTestApp();
            const res = await request(app).get('/restaurants/nearby');

            expect(res.status).toBe(400);
        });
    });
});