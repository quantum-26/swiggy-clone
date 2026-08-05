import type { Restaurant } from "../../types/restaurant";
import './RestaurantCard.css';

interface RestaurantCardProps {
    restaurant: Restaurant;
}

export function RestaurantCard({ restaurant }: RestaurantCardProps){
    const {
    name,
    cuisine,
    rating,
    priceForTwo,
    deliveryTimeMinutes,
    imageUrl,
    isPromoted,
  } = restaurant;
//   Props typed via RestaurantCardProps, destructured from a single restaurant prop — not eight individual props. 
// If the Restaurant shape grows, this component's signature doesn't have to change.

  return (
    <article className="restaurant-card">
        <div className="restaurant-card__image-wrap">
            <img
                src={imageUrl}
                alt={`${name} restaurant`}
                className="restaurant-card__image"
                loading="lazy"
            />
            {/* native browser lazy-loading, zero JS cost */}
            {
                isPromoted && (
                    <span className="restaurant-card__badge">Promoted</span>
                )
            }
        </div>

        <div className="restaurant-card__body">
            <h3 className="restaurant-card__name">{name}</h3>
            <p className="restaurant-card__cuisine">{cuisine.join(', ')}</p>

            <div className="restaurant-card__meta">
                <span className="restaurant-card__rating"
                    aria-label={`Rated ${rating} out of 5`}
                >   
                    ★ {rating}
                </span>

                {/* a screen reader shouldn't announce "•" three times per card; 
                it should announce "Rated 4.3 out of 5" as one coherent phrase */}
                <span aria-hidden="true">•</span>
                <span>{deliveryTimeMinutes} min</span>
                <span aria-hidden="true">•</span>
                <span>₹{priceForTwo} for two</span>
            </div>
        </div>
    </article>
  )
}