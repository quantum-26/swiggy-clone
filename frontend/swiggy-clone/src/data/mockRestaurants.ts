import type { Restaurant } from "../types/restaurant";

// Placeholder data — replaced by a real fetch to restaurant-service on Day 2.
// Kept deliberately small (8 items) for today; Day 2's "500+ items" stress
// test for useTransition/useDeferredValue comes from restaurant-service's
// own seed data, not from here.
export const mockRestaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'Punjabi Tadka',
    cuisine: ['North Indian', 'Punjabi'],
    rating: 4.3,
    priceForTwo: 400,
    deliveryTimeMinutes: 32,
    imageUrl: 'https://picsum.photos/seed/r1/400/300',
    isPromoted: true,
  },
  {
    id: 'r2',
    name: 'Dragon Wok',
    cuisine: ['Chinese', 'Thai'],
    rating: 4.1,
    priceForTwo: 350,
    deliveryTimeMinutes: 28,
    imageUrl: 'https://picsum.photos/seed/r2/400/300',
  },
  {
    id: 'r3',
    name: 'Pizza Fiesta',
    cuisine: ['Italian', 'Pizza'],
    rating: 4.5,
    priceForTwo: 500,
    deliveryTimeMinutes: 25,
    imageUrl: 'https://picsum.photos/seed/r3/400/300',
  },
  {
    id: 'r4',
    name: 'Sushi Central',
    cuisine: ['Japanese', 'Sushi'],
    rating: 4.6,
    priceForTwo: 700,
    deliveryTimeMinutes: 40,
    imageUrl: 'https://picsum.photos/seed/r4/400/300',
    isPromoted: true,
  },
  {
    id: 'r5',
    name: 'Burger Barn',
    cuisine: ['American', 'Burgers'],
    rating: 3.9,
    priceForTwo: 300,
    deliveryTimeMinutes: 22,
    imageUrl: 'https://picsum.photos/seed/r5/400/300',
  },
  {
    id: 'r6',
    name: 'South Spice',
    cuisine: ['South Indian'],
    rating: 4.4,
    priceForTwo: 250,
    deliveryTimeMinutes: 30,
    imageUrl: 'https://picsum.photos/seed/r6/400/300',
  },
  {
    id: 'r7',
    name: 'Taco Fiesta',
    cuisine: ['Mexican'],
    rating: 4.0,
    priceForTwo: 450,
    deliveryTimeMinutes: 35,
    imageUrl: 'https://picsum.photos/seed/r7/400/300',
  },
  {
    id: 'r8',
    name: 'The Salad Bar',
    cuisine: ['Healthy', 'Salads'],
    rating: 4.2,
    priceForTwo: 380,
    deliveryTimeMinutes: 20,
    imageUrl: 'https://picsum.photos/seed/r8/400/300',
  },
];