import type { ApiRestaurant } from "../types/restaurant";

interface ListRestaurantParams {
    search?: string;
    cuisine?: string;
    minRating?: number;
    page?: number;
    pageSize?: number;
}

interface ListRestaurantResponse {
    restaurants: ApiRestaurant[];
    page: number;
    pageSize: number;
}

/**
 * Hits restaurant-service through api-gateway, via Vite's dev proxy.
 *
 * Deliberately no AbortController here. That's not an oversight — Week 4
 * of the plan has a dedicated [B] exercise where you REPRODUCE a real
 * race condition on this exact search flow (a slow response for an
 * earlier keystroke overwriting a newer one), then fix it with
 * AbortController. Adding it now would quietly prevent that bug from
 * ever happening, which defeats the exercise before you get to it.
 */
export async function fetchRestaurants(
    params: ListRestaurantParams = {},
): Promise<ListRestaurantResponse> {
    const query = new URLSearchParams();

    if(params.search) query.set('search', params.search);
    if(params.cuisine) query.set('cuisine', params.cuisine);
    if(params.minRating !== undefined) query.set('minRating', String(params.minRating)); 
    if(params.page !== undefined) query.set('page', String(params.page));
    if(params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));

    const response = await fetch(`/api/restaurants?${query.toString()}`);

    if(!response.ok) {
        throw new Error(`Failed to fetch restaurants: ${response.status}`);
    }

    return response.json();
}