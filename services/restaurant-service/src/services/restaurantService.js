export class RestaurantService {
    constructor(restaurantRepository) {
        this.restaurantRepository = restaurantRepository;
    }

    async listRestaurants({ cuisine, minRating, page = 1, pageSize = 20 }) {
        const safePageSize = Math.min(Math.max(pageSize, 1), 50);
        const safePage = Math.max(page, 1);
        const offset = (safePage - 1) * safePageSize;

        const restaurants = await this.restaurantRepository.findAll({
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
}