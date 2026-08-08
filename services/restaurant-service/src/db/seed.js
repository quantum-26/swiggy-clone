import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

const CUISINES = [
    'North Indian', 'South Indian', 'Chinese', 'Italian', 'Mexican',
    'Thai', 'Continental', 'Fast Food', 'Bakery', 'Desserts',
];

const MENU_ITEM_NAMES = {
    'North Indian': ['Butter Chicken', 'Paneer Tikka', 'Dal Makhani', 'Naan', 'Biryani'],
    'South Indian': ['Masala Dosa', 'Idli Sambar', 'Vada', 'Uttapam', 'Filter Coffee'],
    'Chinese': ['Hakka Noodles', 'Manchurian', 'Fried Rice', 'Spring Rolls', 'Dim Sum'],
    'Italian': ['Margherita Pizza', 'Pasta Alfredo', 'Lasagna', 'Garlic Bread', 'Tiramisu'],
    'Mexican': ['Tacos', 'Burrito Bowl', 'Nachos', 'Quesadilla', 'Churros'],
    'Thai': ['Pad Thai', 'Green Curry', 'Tom Yum Soup', 'Spring Rolls', 'Mango Sticky Rice'],
    'Continental': ['Grilled Chicken', 'Caesar Salad', 'Club Sandwich', 'Soup of the Day', 'Steak'],
    'Fast Food': ['Cheeseburger', 'Fries', 'Chicken Nuggets', 'Hot Dog', 'Onion Rings'],
    'Bakery': ['Croissant', 'Chocolate Cake', 'Muffin', 'Bagel', 'Cinnamon Roll'],
    'Desserts': ['Gulab Jamun', 'Ice Cream Sundae', 'Brownie', 'Kulfi', 'Cheesecake'],
};

const CENTER_LAT = 12.9716; // Bangalore-ish center — dev data only
const CENTER_LNG = 77.5946;
const SPREAD = 0.15;

// Bumped from 25 → configurable, default 2000. This isn't arbitrary: below
// a few hundred rows Postgres's planner will keep choosing a sequential
// scan even WITH an index present, because reading that few rows off disk
// beats the overhead of an index lookup. You need real volume for
// EXPLAIN ANALYZE to show the planner changing its mind — that's the
// whole point of today's lab, not just "more test data."
const RESTAURANT_COUNT = Number(process.env.SEED_COUNT || 2000);
const BATCH_SIZE = 500;

function randomOffset() {
    return (Math.random() - 0.5) * 2 * SPREAD;
}

function buildRestaurantRow() {
    const cuisine = faker.helpers.arrayElement(CUISINES);
    return {
        name: `${faker.company.name()} ${faker.helpers.arrayElement(['Kitchen', 'Restaurant', 'Cafe', 'Diner', 'House'])}`,
        cuisine,
        latitude: CENTER_LAT + randomOffset(),
        longitude: CENTER_LNG + randomOffset(),
        rating: faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
        priceRange: faker.number.int({ min: 1, max: 4 }),
        isOpen: faker.datatype.boolean({ probability: 0.85 }),
    };
}

/*
    Multi-row INSERT for a whole batch, instead of one INSERT per
    restaurant. The Day 1 seed script awaited a separate query per row —
    fine at 25 rows, but that's 2000 sequential network round-trips to
    Postgres at this scale, which is the actual bottleneck (not the insert
    itself). Building one INSERT ... VALUES (...), (...), (...) statement
    per batch turns 2000 round-trips into 4.

    RETURNING id, cuisine matters here: we need each new restaurant's id
    to attach menu items to it next, and its cuisine to know which menu
    template to use — without a second SELECT to look them back up.
*/
async function insertRestaurantBatch(client, rows) {
    const values = [];
    const placeholders = rows.map((r, i) => {
        const base = i * 7;
        values.push(r.name, r.cuisine, r.latitude, r.longitude, r.rating, r.priceRange, r.isOpen);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(', ');

    const result = await client.query(
        `INSERT INTO restaurants (name, cuisine, latitude, longitude, rating, price_range, is_open)
         VALUES ${placeholders}
         RETURNING id, cuisine`,
        values
    );

    return result.rows;
}

async function insertMenuItemsBatch(client, restaurantRows) {
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const { id, cuisine } of restaurantRows) {
        const menuNames = MENU_ITEM_NAMES[cuisine];

        for (const itemName of menuNames) {
            values.push(
                id,
                itemName,
                faker.lorem.sentence({ min: 6, max: 12 }),
                faker.number.float({ min: 80, max: 450, fractionDigits: 2 }),
                faker.datatype.boolean({ probability: 0.6 }),
                faker.datatype.boolean({ probability: 0.9 }),
            );
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
            );
            paramIndex += 6;
        }
    }

    if (placeholders.length === 0) return;

    // 500 restaurants × 5 menu items × 6 params = 15,000 params — comfortably
    // under Postgres's 65,535-param-per-query hard limit. Worth knowing that
    // limit exists; it's why BATCH_SIZE is 500 and not "all 2000 at once."
    await client.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, is_veg, is_available)
         VALUES ${placeholders.join(', ')}`,
        values
    );
}


async function seed() {
    const client = await pool.connect();

    try {
        console.log('Seeding restaurants...');
        await client.query('BEGIN');

        // Re-runnable: wipe first. CASCADE clears menu_items via the FK.
        await client.query('TRUNCATE restaurants CASCADE');

        /*
            Why the transaction wrapping matters here specifically: without BEGIN/COMMIT, 
            a crash halfway through (say, on restaurant #14) leaves you with 13 restaurants 
            and their menus, plus one restaurant with zero menu items — a silently smaller, 
            misleading dataset that could confuse later debugging ("why does this restaurant have no menu?").
             Wrapping the whole seed in one transaction means it's all-or-nothing. The TRUNCATE ... CASCADE 
             at the top also makes this script idempotent — safe to re-run anytime you want fresh data, rather than accumulating duplicates.
        */

        let inserted = 0;
        while (inserted < RESTAURANT_COUNT) {
            const batchCount = Math.min(BATCH_SIZE, RESTAURANT_COUNT - inserted);
            const rows = Array.from({ length: batchCount }, buildRestaurantRow);

            const restaurantRows = await insertRestaurantBatch(client, rows);
            await insertMenuItemsBatch(client, restaurantRows);

            inserted += batchCount;
            console.log(`  ...${inserted}/${RESTAURANT_COUNT}`);
        }     

        await client.query('COMMIT');
        console.log('Seeded 25 restaurants with ~5 menu items each (125 total menu items).');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed, rolled back:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(() => process.exit(1));