// Exact shape restaurant-service returns, through api-gateway. Kept
// separate from the UI-facing Restaurant type below — this is the
// Adapter pattern: the real backend shape (single cuisine string, no
// images, no delivery ETA yet) is isolated here. mapToRestaurant() is
// the one seam that translates it; if the backend schema changes,
// RestaurantCard/RestaurantGrid never have to know.
export interface ApiRestaurant {
  id: string;
  name: string;
  cuisine: string;             // one value in the DB today, not an array
  latitude: number;
  longitude: number;
  rating: number;
  price_range: 1 | 2 | 3 | 4;  // Zomato/Yelp-style tier, not a rupee figure
  is_open: boolean;
}

export interface Restaurant {
    id: string;
    name: string;
    cuisine: string[];
    rating: number;
    priceForTwo: number;
    deliveryTimeMinutes: number;
    imageUrl: string;
    isPromoted?: boolean
}