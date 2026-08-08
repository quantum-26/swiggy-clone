/*
    In-memory stand-in for RestaurantRepository. It implements the SAME
    method contract (findAll, findById, findMenuItemsByRestaurantId,
    findNearby) with plain array filtering instead of SQL — the point is
    NOT to re-verify the Haversine math itself (that's what today's
    EXPLAIN ANALYZE session against real Postgres already proved), it's
    to verify that the service/controller/route layer calls the
    repository correctly and handles what comes back correctly.
*/
export class FakeRestaurantRepository {
    constructor(restaurants = [], menuItemsByRestaurantId = {}) {
        this.restaurants = restaurants;
        this.menuItemsByRestaurantId = menuItemsByRestaurantId;
    }

    async findAll({ search, cuisine, minRating, limit = 30, offset = 0 } = {}) {
        let rows = [...this.restaurants];

        if (search) {
            const term = search.toLowerCase();
            rows = rows.filter((r) => r.name.toLowerCase().includes(term));
        }

        if (cuisine) {
            rows = rows.filter((r) => r.cuisine === cuisine);
        }

        if (minRating) {
            rows = rows.filter((r) => r.rating >= minRating);
        }

        rows.sort((a, b) => b.rating - a.rating);

        return rows.slice(offset, offset + limit);
    }

    async findById(id) {
        return this.restaurants.find((r) => r.id === id) || null;
    }

    async findMenuItemsByRestaurantId(restaurantId) {
        return this.menuItemsByRestaurantId[restaurantId] || [];
    }

    async findNearby({ latitude, longitude, radiusKm = 5, cuisine, limit = 20 }) {
        const toRad = (d) => (d * Math.PI) / 180;

        const rows = this.restaurants
            .filter((r) => r.is_open)
            .filter((r) => !cuisine || r.cuisine === cuisine)
            .map((r) => {
                // Standard Haversine — mathematically equivalent to the SQL
                // version, just expressed in plain JS for the fake.
                const dLat = toRad(r.latitude - latitude);
                const dLng = toRad(r.longitude - longitude);
                const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(toRad(latitude)) * Math.cos(toRad(r.latitude)) * Math.sin(dLng / 2) ** 2;
                const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return { ...r, distanceKm };
            })
            .filter((r) => r.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        return rows.slice(0, limit);
    }
}