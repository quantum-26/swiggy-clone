import type { Restaurant } from "../types/restaurant";


export interface RestaurantFilters {
    cuisine: string | null;
    maxPriceForTwo: number | null;
    minRating: number;
}

/*
    Deliberately expensive — this IS the Day 4 [B] lab requirement, not
    an accident. In real code you'd never write a busy-loop like the one
    below; it stands in for genuinely expensive synchronous work you DO
    hit in practice (a multi-factor ranking score, a client-side
    geospatial re-sort, filtering+sorting a few thousand rows with
    several comparators). The goal is a computation slow enough — tens of
    milliseconds across 500 items — that running it synchronously inside
    a normal render visibly blocks the main thread, which is exactly what
    BrowseAllNaive.tsx is built to demonstrate.
*/

export function expensiveFilterAndSort(
    restaurants: Restaurant[],
    filters: RestaurantFilters,
): Restaurant[] {
    const filtered = restaurants.filter((r) => {
    if (filters.cuisine && !r.cuisine.includes(filters.cuisine)) return false;
    if (filters.maxPriceForTwo !== null && r.priceForTwo > filters.maxPriceForTwo) return false;
    if (r.rating < filters.minRating) return false;
    return true;
  });

  // Artificial per-item cost, repeated enough times per restaurant that
  // 500 items adds up to real, feelable milliseconds on the main thread.
  const scored = filtered.map((r) => {
    let score = 0;
    for (let i = 0; i < 20000; i++) {
      score += Math.sqrt(i) * r.rating - Math.sin(i);
    }
    return { restaurant: r, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.restaurant);

}