import type { ApiRestaurant, Restaurant } from "../types/restaurant";

const PRICE_RANGE_TO_RUPEES: Record<ApiRestaurant['price_range'], number> = {
  1: 200,
  2: 400,
  3: 700,
  4: 1200,
};

/**
 * Adapter: translates the real restaurant-service response into the
 * shape RestaurantCard/RestaurantGrid already render. Three fields are
 * placeholders — clearly marked, replaced by real data as later weeks
 * build the systems that would actually produce them:
 *   - imageUrl            no image-upload feature exists yet
 *   - deliveryTimeMinutes real ETA needs delivery-service (Week 4)
 *   - isPromoted          real "promoted" status is a future ads
 *                          feature; using a rating threshold as a
 *                          stand-in so Day 1's badge UI has something
 *                          real to render against today
 */
export function mapToRestaurant(api: ApiRestaurant): Restaurant {
    return {
        id: api.id,
        name: api.name,
        cuisine: [api.cuisine],
        // node-postgres returns NUMERIC columns (rating is NUMERIC(2,1)) as
        // STRINGS at runtime, not numbers — a deliberate pg driver choice to
        // avoid floating-point precision loss on money-like values. TypeScript
        // has no way to know this; Number(...) here is a real, necessary
        // runtime coercion, not defensive paranoia.
        rating: Number(api.rating),
        priceForTwo: PRICE_RANGE_TO_RUPEES[api.price_range],
        deliveryTimeMinutes: estimateDeliveryMinutesPlaceholder(api.id),
        imageUrl: `https://picsum.photos/seed/${api.id}/400/300`,
        isPromoted: Number(api.rating) >= 4.5,
    }
}

// Deterministic placeholder — same restaurant always gets the same fake
// ETA instead of a new random one on every render. Purely cosmetic until
// real delivery-time estimation exists.
function estimateDeliveryMinutesPlaceholder(id: string): number {
    let hash = 0;

    for(let i=0; i<id.length; i++){
        hash = (hash * 31 + id.charCodeAt(i)) % 1000;
    }

    return 20 + (hash % 26); // 20–45 minute range
}