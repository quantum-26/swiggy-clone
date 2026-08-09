import type { ChangeEvent } from "react";
import './FilterPanel.css';

interface FilterPanelProps {
  cuisine: string;
  onCuisineChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  minRating: number;
  onMinRatingChange: (value: number) => void;
  cuisineOptions: string[];
}

export function FilterPanel({
  cuisine,
  onCuisineChange,
  maxPrice,
  onMaxPriceChange,
  minRating,
  onMinRatingChange,
  cuisineOptions,
}: FilterPanelProps) {
  function handleCuisine(e: ChangeEvent<HTMLSelectElement>) {
    onCuisineChange(e.target.value);
  }

  function handleMaxPrice(e: ChangeEvent<HTMLSelectElement>) {
    onMaxPriceChange(e.target.value);
  }

  function handleMinRating(e: ChangeEvent<HTMLInputElement>) {
    onMinRatingChange(Number(e.target.value));
  }

  return (
    <div className="filter-panel" role="group" aria-label="Filter restaurants">
      <div className="filter-panel__field">
        <label htmlFor="filter-cuisine">Cuisine</label>
        <select id="filter-cuisine" value={cuisine} onChange={handleCuisine}>
          <option value="">All cuisines</option>
          {cuisineOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__field">
        <label htmlFor="filter-price">Max price for two</label>
        <select id="filter-price" value={maxPrice} onChange={handleMaxPrice}>
          <option value="">Any price</option>
          <option value="200">Under ₹200</option>
          <option value="400">Under ₹400</option>
          <option value="700">Under ₹700</option>
          <option value="1200">Under ₹1200</option>
        </select>
      </div>

      <div className="filter-panel__field">
        <label htmlFor="filter-rating">
          Minimum rating: {minRating.toFixed(1)}
        </label>
        <input
          id="filter-rating"
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={minRating}
          onChange={handleMinRating}
        />
      </div>
    </div>
  );
}