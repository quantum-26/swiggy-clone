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
        const conditons = [];
        const values = [];

        // ILIKE = case-insensitive LIKE in Postgres. No trigram/GIN index
        // needed yet at 25-ish seed rows — a plain index scan is fine.
        // Worth revisiting if the catalog grows into the thousands; that's
        // a pg_trgm + GIN index conversation, not a Day 2 concern.
        if(search){
            values.push(`%${search}`);
            conditons.push(`name ILIKE $${values.length}`);
        }


        if(cuisine) {
            values.push(cuisine);
            conditons.push(`cuisine = $${values.length}`);
        }

        if(minRating){
            values.push(minRating);
            conditons.push(`rating >= $${values.length}`);
        }

        const whereClause = conditons.length > 0 ? `WHERE ${conditons.join(' AND ')}` : '';

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
}