import { useEffect, useMemo, useState } from "react";
import { RestaurantGrid } from "../RestaurantGrid/RestaurantGrid";
import { FilterPanel } from "../FilterPanel/FilterPanel";
import { fetchRestaurants } from "../../api/restaurantApi";
import { mapToRestaurant } from "../../utils/mapRestaurant";
import { expensiveFilterAndSort } from "../../utils/expensiveFilterAndSort";
import type { Restaurant } from "../../types/restaurant";

const BROWSE_PAGE_SIZE = 500;

/*
    NAIVE VERSION — Day 4 [B] lab, step 1 of 3. Deliberately unoptimized:
    every filter change runs expensiveFilterAndSort() SYNCHRONOUSLY as
    part of the SAME render that the state update triggers. By default
    every setState-driven render is "urgent" as far as React's scheduler
    is concerned — the browser can't paint the updated <select>/<input>
    until this render, expensive computation included, finishes.

    Try it: switch to this component (see App.tsx), open the cuisine
    dropdown, pick a different option a few times in a row. On 500 items
    you should feel a beat of freeze before the UI updates — that's the
    main thread being blocked by expensiveFilterAndSort(), not network
    latency (there's no network call happening on filter change at all).

    This file exists ONLY to demonstrate the problem. See
    BrowseAllTransition.tsx and BrowseAllDeferred.tsx for the two fixes.
*/
export function BrowseAllNaive() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [cuisine, setCuisine] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);

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

  // The expensive line — reruns on every filter change, synchronously,
  // blocking paint until it finishes.
  const filtered = expensiveFilterAndSort(allRestaurants, {
    cuisine: cuisine || null,
    maxPriceForTwo: maxPrice ? Number(maxPrice) : null,
    minRating,
  });

  if (loading) {
    return <p role="status">Loading restaurants...</p>;
  }

  return (
    <div className="browse-all">
      <FilterPanel
        cuisine={cuisine}
        onCuisineChange={setCuisine}
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
        minRating={minRating}
        onMinRatingChange={setMinRating}
        cuisineOptions={cuisineOptions}
      />
      <p className="browse-all__count">{filtered.length} restaurants</p>
      <RestaurantGrid restaurants={filtered} />
    </div>
  );
}