export interface Restaurant {
    id: string;
    name: string;
    cuisine: string[];
    rating: number;
    priceForTwo: number;
    deliveryTimeMinutes: number;
    imageUrl: string;
    isPromoted?: boolean
}