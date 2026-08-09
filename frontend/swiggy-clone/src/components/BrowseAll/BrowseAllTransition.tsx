import { useEffect, useMemo, useState, useTransition } from "react";
import { RestaurantGrid } from "../RestaurantGrid/RestaurantGrid";
import { FilterPanel } from "../FilterPanel/FilterPanel";
import { fetchRestaurants } from "../../api/restaurantApi";
import { mapToRestaurant } from "../../utils/mapRestaurant";
import { expensiveFilterAndSort } from "../../utils/expensiveFilterAndSort";
import type { Restaurant } from "../../types/restaurant";

const BROWSE_PAGE_SIZE = 500;

/*
    FIX #1 — useTransition. Two pieces of state per filter change:
      - cuisine/maxPrice/minRating: the "urgent" values, updated
        immediately outside any transition — these drive what the
        FilterPanel controls SHOW right now, so they must never lag.
      - filtered: the "non-urgent" DERIVED value, updated inside
        startTransition — React is explicitly allowed to interrupt or
        delay this specific update to keep more urgent updates
        (the next keystroke, the next dropdown change) responsive.

    isPending flips true while a transitioned update is still computing,
    which gives the UI a way to show "updating..." feedback instead of
    freezing. Important: useTransition does NOT make
    expensiveFilterAndSort() run faster — the wall-clock cost is
    identical to the naive version. What changes is WHEN React allows
    that cost to block a paint.
*/
export function BrowseAllTransition() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [cuisine, setCuisine] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);

  const [isPending, startTransition] = useTransition();
  const [filtered, setFiltered] = useState<Restaurant[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setLoading(true);
      const response = await fetchRestaurants({ pageSize: BROWSE_PAGE_SIZE });
      if (!isCancelled) {
        const mapped = response.restaurants.map(mapToRestaurant);
        setAllRestaurants(mapped);
        setFiltered(mapped);
        setLoading(false);
      }
    }

    load();
    return () => { isCancelled = true; };
  }, []);

  const cuisineOptions = useMemo(
    () => Array.from(new Set(allRestaurants.flatMap((r) => r.cuisine))).sort(),
    [allRestaurants],
  );

  function applyFilters(next: { cuisine: string; maxPrice: string; minRating: number }) {
    startTransition(() => {
      setFiltered(
        expensiveFilterAndSort(allRestaurants, {
          cuisine: next.cuisine || null,
          maxPriceForTwo: next.maxPrice ? Number(next.maxPrice) : null,
          minRating: next.minRating,
        }),
      );
    });
  }

  function handleCuisineChange(value: string) {
    setCuisine(value); // urgent — updates the dropdown instantly
    applyFilters({ cuisine: value, maxPrice, minRating }); // non-urgent
  }

  function handleMaxPriceChange(value: string) {
    setMaxPrice(value);
    applyFilters({ cuisine, maxPrice: value, minRating });
  }

  function handleMinRatingChange(value: number) {
    setMinRating(value);
    applyFilters({ cuisine, maxPrice, minRating: value });
  }

  if (loading) {
    return <p role="status">Loading restaurants...</p>;
  }

  return (
    <div className="browse-all">
      <FilterPanel
        cuisine={cuisine}
        onCuisineChange={handleCuisineChange}
        maxPrice={maxPrice}
        onMaxPriceChange={handleMaxPriceChange}
        minRating={minRating}
        onMinRatingChange={handleMinRatingChange}
        cuisineOptions={cuisineOptions}
      />
      {isPending && (
        <p className="browse-all__status" role="status">Updating results...</p>
      )}
      <p className="browse-all__count">{filtered.length} restaurants</p>
      <RestaurantGrid restaurants={filtered} />
    </div>
  );
}