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

function randomOffset() {
    return (Math.random() - 0.5) * 2 * SPREAD;
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

        for(let i=0; i< 25; i++){
            const cuisine = faker.helpers.arrayElement(CUISINES);

            const restaurantResult = await client.query(
                `INSERT INTO restaurants (name, cuisine, latitude, longitude, rating, price_range, is_open)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    `${faker.company.name()} ${faker.helpers.arrayElement(['Kitchen', 'Restaurant', 'Cafe', 'Diner', 'House'])}`,
                    cuisine,
                    CENTER_LAT + randomOffset(),
                    CENTER_LNG + randomOffset(),
                    faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
                    faker.number.int({ min: 1, max: 4 }),
                    faker.datatype.boolean({ probability: 0.85 }),
                ]
            );

            const restaurantId = restaurantResult.rows[0].id;
            const menuNames = MENU_ITEM_NAMES[cuisine];

            for (const itemName of menuNames) {
                await client.query(
                    `INSERT INTO menu_items (restaurant_id, name, description, price, is_veg, is_available)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        restaurantId,
                        itemName,
                        faker.lorem.sentence({ min: 6, max: 12 }),
                        faker.number.float({ min: 80, max: 450, fractionDigits: 2 }),
                        faker.datatype.boolean({ probability: 0.6 }),
                        faker.datatype.boolean({ probability: 0.9 }),
                    ]
                );
            };
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