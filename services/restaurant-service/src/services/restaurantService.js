export class RestaurantService {
    constructor(restaurantRepository) {
        this.restaurantRepository = restaurantRepository;
    }

    async listRestaurants({ search, cuisine, minRating, page = 1, pageSize = 20 }) {
        const safePageSize = Math.min(Math.max(pageSize, 1), 50);
        const safePage = Math.max(page, 1);
        const offset = (safePage - 1) * safePageSize;

        const restaurants = await this.restaurantRepository.findAll({
            search,
            cuisine,
            minRating,
            limit: safePageSize,
            offset
        });

        return {
            restaurants,
            page: safePage,
            pageSize: safePageSize
        }
    }

    async getRestaurantWithMenu(id) {
        const restaurant = await this.restaurantRepository.findById(id);

        if(!restaurant) {
            const error = new Error('Restaurant not found');
            error.statusCode = 404;
            throw error;
        }

        const menuItems = await this.restaurantRepository.findMenuItemsByRestaurantId(id);

        return { ...restaurant, menuItems }
    }

    async findNearbyRestaurants({ latitude, longitude, radiusKm, cuisine, limit }) {
        if (latitude === undefined || longitude === undefined) {
            const error = new Error('latitude and longitude are required');
            error.statusCode = 400;
            throw error;
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            const error = new Error('latitude must be between -90 and 90, longitude between -180 and 180');
            error.statusCode = 400;
            throw error;
        }

        // Capped, not just defaulted — an uncapped radiusKm (say, 5000)
        // would blow the bounding box out past any usefulness of the
        // index, turning this back into a near-full-table scan. 25km is
        // a generous "still meaningfully local" ceiling for a food
        // delivery radius.
        const safeRadius = Math.min(Math.max(radiusKm ?? 5, 0.5), 25);
        const safeLimit = Math.min(Math.max(limit ?? 20, 1), 50);

        const restaurants = await this.restaurantRepository.findNearby({
            latitude,
            longitude,
            radiusKm: safeRadius,
            cuisine,
            limit: safeLimit,
        });

        return {
            restaurants,
            center: { latitude, longitude },
            radiusKm: safeRadius,
        };
    }
}