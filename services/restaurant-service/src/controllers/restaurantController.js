export class RestaurantController {
    constructor(restaurantService) {
        this.restaurantService = restaurantService;
    }

    list = async(req, res, next) => {
        try {
            const { cuisine, minRating, page, pasgeSize } = req.query;

            const result = await this.restaurantService.listRestaurants({
                cuisine: cuisine || undefined,
                minRating: minRating ? Number(minRating) : undefined,
                page: page ? Number(page) : 1,
                pasgeSize: pasgeSize ? Number(pasgeSize) : 20,
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