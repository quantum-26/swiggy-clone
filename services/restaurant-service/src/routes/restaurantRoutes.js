import { Router } from 'express';

export function createRestaurantRoutes(restaurantController) {
    const router = Router();

    router.get('/', restaurantController.list);
    router.get('/:id', restaurantController.getById);


    return router;
}