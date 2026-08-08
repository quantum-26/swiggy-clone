import { Router } from 'express';

export function createRestaurantRoutes(restaurantController) {
    const router = Router();

    // /nearby MUST be registered before /:id. Express matches routes in
    // registration order — if /:id came first, a request to GET
    // /restaurants/nearby would match /:id with id="nearby", hit
    // restaurantService.getRestaurantWithMenu("nearby"), and 404 from a
    // failed UUID lookup instead of ever reaching the nearby handler.
    // This is a genuinely common Express bug, worth being able to spot
    // instantly in a code review.
    router.get('/nearby', restaurantController.nearby);
    router.get('/', restaurantController.list);
    router.get('/:id', restaurantController.getById);


    return router;
}