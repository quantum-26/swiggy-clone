import { Router } from 'express';


/*
A small but important pattern: 
createAuthRoutes takes the controller in, rather than importing a singleton controller instance directly.
 This is the same dependency-injection idea as the repository — it means routes, controllers, services, and repositories 
 can all be wired together in one place (index.js) and swapped or mocked independently in tests.
*/
export function createAuthRoutes(authController){
    const router = Router();

    router.post('/signup', authController.signup);
    router.post('/login', authController.login);

    return router;
}