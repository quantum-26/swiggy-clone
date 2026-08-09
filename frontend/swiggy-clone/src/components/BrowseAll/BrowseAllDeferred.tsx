import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { RestaurantGrid } from "../RestaurantGrid/RestaurantGrid";
import { FilterPanel } from "../FilterPanel/FilterPanel";
import { fetchRestaurants } from "../../api/restaurantApi";
import { mapToRestaurant } from "../../utils/mapRestaurant";
import { expensiveFilterAndSort } from "../../utils/expensiveFilterAndSort";
import type { Restaurant } from "../../types/restaurant";

const BROWSE_PAGE_SIZE = 500;

interface FilterState {
  cuisine: string;
  maxPrice: string;
  minRating: number;
}

/*
    FIX #2 — useDeferredValue. Different mental model, same underlying
    scheduler mechanism as useTransition. Instead of manually wrapping
    the expensive UPDATE, you keep ONE piece of filter state and ask
    React for a "deferred" copy of it. On a rapid filter change, React
    renders immediately with the OLD deferred value (so the screen never
    freezes), then re-renders in the background once the deferred value
    catches up to the real one, running the expensive computation then.

    When to reach for which (this is the actual interview-relevant
    comparison to have ready):
      - useTransition: you're the one TRIGGERING the expensive update
        from inside an event handler, and you want an explicit isPending
        flag for feedback. More code, more control.
      - useDeferredValue: you're just RECEIVING a value (props, a
        parent's state, something you don't own the setter for) and want
        rendering FROM it to not block. Less code, no isPending — you
        infer staleness by comparing the deferred value to the live one.
*/
export function BrowseAllDeferred() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    cuisine: '',
    maxPrice: '',
    minRating: 0,
  });

  // React may lag this behind `filters` during rapid updates.
  const deferredFilters = useDeferredValue(filters);
  const isStale = deferredFilters !== filters;

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setLoading(true);
      const response = await fetchRestaurants({ pageSize: BROWSE_PAGE_SIZE });
      if (!isCancelled) {
        setAllRestaurants(response.restaurants.map(mapToRestaurant));
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

  // Recomputed only when deferredFilters or allRestaurants actually
  // change — fed the LAGGING value, not the live one, and wrapped in
  // useMemo so it doesn't rerun on renders where neither input changed.
  const filtered = useMemo(
    () =>
      expensiveFilterAndSort(allRestaurants, {
        cuisine: deferredFilters.cuisine || null,
        maxPriceForTwo: deferredFilters.maxPrice ? Number(deferredFilters.maxPrice) : null,
        minRating: deferredFilters.minRating,
      }),
    [allRestaurants, deferredFilters],
  );

  if (loading) {
    return <p role="status">Loading restaurants...</p>;
  }

  return (
    <div className="browse-all">
      <FilterPanel
        cuisine={filters.cuisine}
        onCuisineChange={(value) => setFilters((f) => ({ ...f, cuisine: value }))}
        maxPrice={filters.maxPrice}
        onMaxPriceChange={(value) => setFilters((f) => ({ ...f, maxPrice: value }))}
        minRating={filters.minRating}
        onMinRatingChange={(value) => setFilters((f) => ({ ...f, minRating: value }))}
        cuisineOptions={cuisineOptions}
      />
      {isStale && (
        <p className="browse-all__status" role="status">Updating results...</p>
      )}
      <p className="browse-all__count">{filtered.length} restaurants</p>
      <RestaurantGrid restaurants={filtered} />
    </div>
  );
}