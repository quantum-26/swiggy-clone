import type { Restaurant } from '../../types/restaurant';
import { RestaurantCard } from '../RestaurantCard/RestaurantCard';
import './RestaurantGrid.css';

interface RestaurantGridProps {
  restaurants: Restaurant[];
}

export function RestaurantGrid({ restaurants }: RestaurantGridProps) {
  if (restaurants.length === 0) {
    return <p className="restaurant-grid__empty">No restaurants found.</p>;
  }

  return (
    <div className="restaurant-grid" role="list">
      {restaurants.map((restaurant) => (
        // using the real database id, never the array index.
        <div role="listitem" key={restaurant.id}>
          <RestaurantCard restaurant={restaurant} />
        </div>
      ))}
    </div>
  );
}