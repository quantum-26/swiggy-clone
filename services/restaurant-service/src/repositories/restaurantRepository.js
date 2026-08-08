function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

export class RestaurantRepository {
    constructor(pool){
        this.pool = pool;
    }

    async findAll({
        search,
        cuisine,
        minRating,
        limit = 30,
        offset = 0
    } = {}) {
        const conditions = [];
        const values = [];

        // Now backed by idx_restaurants_name_trgm (pg_trgm GIN index) —
        // see migration 002. The query text is unchanged; the index is
        // what makes it fast at 2000+ rows, ILIKE '%term%' still works
        // exactly the same on a 25-row table, it's just a seq scan either
        // way at that size.
        if(search){
            values.push(`%${search}%`);
            conditions.push(`name ILIKE $${values.length}`);
        }


        if(cuisine) {
            values.push(cuisine);
            conditions.push(`cuisine = $${values.length}`);
        }

        if(minRating){
            values.push(minRating);
            conditions.push(`rating >= $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        values.push(limit);
        const limitParam = `$${values.length}`;
        values.push(offset);
        const offsetParams = `$${values.length}`;

        const result = await this.pool.query(
            `SELECT id, name, cuisine, latitude, longitude, rating, price_range, is_open
             FROM restaurants
             ${whereClause}
             ORDER BY rating DESC
             LIMIT ${limitParam} OFFSET ${offsetParams}`,
            values
        )

        return result.rows;
    }

    async findById(id) {
        const result = await this.pool.query(
            `SELECT id, name, cuisine, latitude, longitude, rating, price_range, is_open
            FROM restaurants
            WHERE id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    async findMenuItemsByRestaurantId(restaurantId) {
        const result = await this.pool.query(
            `SELECT id, name, description, price, is_veg, is_available
            FROM menu_items
            WHERE restaurant_id = $1 AND is_available = true
            ORDER BY name ASC`,
            [restaurantId]
        );

        return result.rows;
    }

    /*
        Two-stage query, and the order matters:

        1. Bounding box first (WHERE latitude BETWEEN ... AND longitude
           BETWEEN ...) — a plain range predicate idx_restaurants_lat_lng
           can satisfy. This is what actually gets us out of a full table
           scan.
        2. Exact Haversine distance computed only on the rows the bounding
           box already narrowed down, then filtered again by the real
           radius (a box isn't a circle — its corners are further from
           the center than radiusKm, so we still need the precise cutoff)
           and sorted.

        LEAST(1.0, GREATEST(-1.0, ...)) clamps the value fed into acos().
        Floating-point rounding can push the cosine-sum expression a hair
        above 1.0 or below -1.0 for points very close to (or exactly at)
        the center point — acos() of anything outside [-1, 1] returns NaN
        in Postgres, which would silently corrupt distance_km for the
        restaurant closest to the search origin. Clamping is the fix.
    */
    async findNearby({ latitude, longitude, radiusKm = 5, cuisine, limit = 20 }) {
        // 1 degree latitude ≈ 111km everywhere on Earth. 1 degree
        // longitude ≈ 111km * cos(latitude), because longitude lines
        // converge toward the poles — a degree of longitude in Bangalore
        // covers less ground than a degree of longitude at the equator.
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.cos(toRadians(latitude)) || 1);

        const values = [
            latitude, longitude,
            latitude - latDelta, latitude + latDelta,
            longitude - lngDelta, longitude + lngDelta,
            radiusKm,
        ];

        let cuisineClause = '';
        if (cuisine) {
            values.push(cuisine);
            cuisineClause = `AND cuisine = $${values.length}`;
        }

        values.push(limit);
        const limitParam = `$${values.length}`;

        // 6371 is Earth's mean radius in kilometers — that's the whole Haversine formula's scale factor
        const result = await this.pool.query(
            `WITH bounded AS (
                SELECT id, name, cuisine, latitude, longitude, rating, price_range, is_open,
                    (
                        6371 * acos(
                            LEAST(1.0, GREATEST(-1.0,
                                cos(radians($1)) * cos(radians(latitude)) *
                                cos(radians(longitude) - radians($2)) +
                                sin(radians($1)) * sin(radians(latitude))
                            ))
                        )
                    ) AS distance_km
                FROM restaurants
                WHERE latitude BETWEEN $3 AND $4
                  AND longitude BETWEEN $5 AND $6
                  AND is_open = true
                  ${cuisineClause}
            )
            SELECT * FROM bounded
            WHERE distance_km <= $7
            ORDER BY distance_km ASC
            LIMIT ${limitParam}`,
            values
        );

        return result.rows;
    }
}