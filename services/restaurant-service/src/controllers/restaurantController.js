export class RestaurantController {
    constructor(restaurantService) {
        this.restaurantService = restaurantService;
    }

    list = async(req, res, next) => {
        try {
            const { search, cuisine, minRating, page, pageSize } = req.query;

            const result = await this.restaurantService.listRestaurants({
                search: search || undefined,
                cuisine: cuisine || undefined,
                minRating: minRating ? Number(minRating) : undefined,
                page: page ? Number(page) : 1,
                pageSize: pageSize ? Number(pageSize) : 20,
            });

            res.status(200).json(result);
        }
        catch(err) {
            next(err);
        }
    }

    nearby = async(req, res, next) => {
        try {
            const { lat, lng, radiusKm, cuisine, limit } = req.query;

            const latitude = lat !== undefined ? Number(lat) : undefined;
            const longitude = lng !== undefined ? Number(lng) : undefined;

            if (latitude === undefined || longitude === undefined || Number.isNaN(latitude) || Number.isNaN(longitude)) {
                const error = new Error('lat and lng query params are required and must be valid numbers');
                error.statusCode = 400;
                throw error;
            }

            const result = await this.restaurantService.findNearbyRestaurants({
                latitude,
                longitude,
                radiusKm: radiusKm ? Number(radiusKm) : undefined,
                cuisine: cuisine || undefined,
                limit: limit ? Number(limit) : undefined,
            });

            res.status(200).json(result);
        }
        catch(err) {
            next(err);
        }
    }
    
    getById = async(req, res, next) => {
        try {
            const { id } = req.params;
            const restaurant = await this.restaurantService.getRestaurantWithMenu(id);

            res.status(200).json({ restaurant});
        }
        catch(err){
            next(err);
        }
    }
}