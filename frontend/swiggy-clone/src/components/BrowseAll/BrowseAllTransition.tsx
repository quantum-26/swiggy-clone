import { useEffect, useMemo, useState, useTransition } from "react";
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
    CORRECTED — the first version of this file called
    expensiveFilterAndSort() eagerly inside the startTransition callback,
    BEFORE calling setState. That meant the expensive work already
    finished by the time React had any state update to schedule, so
    wrapping it in startTransition did nothing for responsiveness — a
    real profiler recording confirmed the busy-loop cost was invisible
    to React entirely (it ran as plain synchronous JS, not as part of
    any render).

    Fixed here: startTransition wraps `transitionFilters` — just the
    filter CRITERIA, not a computed result. expensiveFilterAndSort now
    runs inside useMemo, DURING render, driven by transitionFilters. This
    is what actually lets React treat the computation as interruptible
    low-priority work, because it's now genuinely part of a render that
    React scheduled at transition priority, not a black-box function call
    glued synchronously to the event handler.
*/
export function BrowseAllTransition() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // liveFilters: urgent, drives what the controls SHOW — updates instantly.
  // transitionFilters: only ever updated inside startTransition — this is
  // what the expensive render below actually depends on.
  const [liveFilters, setLiveFilters] = useState<FilterState>({ cuisine: '', maxPrice: '', minRating: 0 });
  const [transitionFilters, setTransitionFilters] = useState<FilterState>({ cuisine: '', maxPrice: '', minRating: 0 });
  const [isPending, startTransition] = useTransition();

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

  // The expensive call now lives HERE — inside render, wrapped in
  // useMemo so it doesn't rerun unless allRestaurants or
  // transitionFilters actually changed.
  const filtered = useMemo(
    () =>
      expensiveFilterAndSort(allRestaurants, {
        cuisine: transitionFilters.cuisine || null,
        maxPriceForTwo: transitionFilters.maxPrice ? Number(transitionFilters.maxPrice) : null,
        minRating: transitionFilters.minRating,
      }),
    [allRestaurants, transitionFilters],
  );

  function updateFilters(next: FilterState) {
    setLiveFilters(next); // urgent — controls update immediately
    startTransition(() => {
      setTransitionFilters(next); // triggers the expensive render, at transition priority
    });
  }

  if (loading) {
    return <p role="status">Loading restaurants...</p>;
  }

  return (
    <div className="browse-all">
      <FilterPanel
        cuisine={liveFilters.cuisine}
        onCuisineChange={(value) => updateFilters({ ...liveFilters, cuisine: value })}
        maxPrice={liveFilters.maxPrice}
        onMaxPriceChange={(value) => updateFilters({ ...liveFilters, maxPrice: value })}
        minRating={liveFilters.minRating}
        onMinRatingChange={(value) => updateFilters({ ...liveFilters, minRating: value })}
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