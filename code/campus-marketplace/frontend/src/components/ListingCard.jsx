import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from './LoadingSpinner'
import './ListingCard.css'

export default function ListingCard({ listing }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleClick = () => {
    setLoading(true);
    setTimeout(() => {
      navigate(`/listing/${listing.listing_id}`);
    }, 400);
  }

  // Format the price based on SELL vs BORROW
  const priceLabel = listing.type === 'BORROW' 
    ? `₹${listing.price_per_day}/day` 
    : `₹${listing.price}`
    
  // Temporarily show the category_id until the backend is updated with a JOIN
  const displayCategory = listing.category_name || `Category ${listing.category_id}`

  return (
    <div className="listing-card">
      <span className="listing-card-tag">{displayCategory}</span>
        {listing.primary_image ? (
          <img 
            src={listing.primary_image} 
            alt={listing.title} 
            className="listing-card-img" 
          />
        ) : (
          <div className="listing-card-img placeholder-img">
            No Image
          </div>
        )}
      <div className="listing-card-body">
        <div className='listing-card-info'>
          <h3 className='listing-card-title'>{listing.title}</h3>
          <p className="listing-card-desc">{listing.description}</p>
          <span className="listing-card-price">{priceLabel}</span>
        </div>
        <button className="listing-card-btn" onClick={handleClick} disabled={loading}>
          More details
        </button>
      </div>
      {loading && (
         <div className="listing-card-overlay">
           <LoadingSpinner label="Opening..." />
         </div>
        )}
    </div>
  )
}