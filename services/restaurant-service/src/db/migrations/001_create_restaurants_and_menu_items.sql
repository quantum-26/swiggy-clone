CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cuisine VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    rating NUMERIC(2,1) NOT NULL DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    price_range SMALLINT NOT NULL DEFAULT 2 CHECK (price_range BETWEEN 1 AND 4),
    is_open BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
/*
 price_range BETWEEN 1 AND 4 uses the 1=$ .. 4=$$$$ convention (like Yelp/Zomato) rather 
 than storing raw currency ranges — cheap to filter on, easy to render as $, $$, etc.
*/

/*
It is a composite index matching the exact filter+sort shape the GET /restaurants endpoint uses (WHERE cuisine = ? ORDER BY rating DESC) 
— built for the actual query, not speculatively.
*/
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine_rating  ON  restaurants(cuisine, rating DESC);

CREATE TABLE IF NOT EXISTS menu_items(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price  NUMERIC(10, 2) NOT NULL CHECK(price >= 0),
    is_veg BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/*
It exists because Postgres does not auto-index foreign keys (only primary keys get that for free) — 
without it, every "get this restaurant's menu" lookup does a full table scan as menu_items grows. 
This is a genuinely common interview gotcha.
*/
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);