import { useNavigate } from 'react-router-dom'
import './ListingCard.css'

export default function ListingCard({ listing }) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/listing/${listing.listing_id}`)
  }

  // Format the price based on SELL vs BORROW
  const priceLabel = listing.type === 'BORROW' 
    ? `₹${listing.price_per_day}/day` 
    : `₹${listing.price}`
    
  // Temporarily show the category_id until the backend is updated with a JOIN
  const displayCategory = listing.category_name || `Category ${listing.category_id}`
  const borrowUntil = listing.borrowed_until ? new Date(listing.borrowed_until).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null

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
        {borrowUntil && <span className="listing-card-availability">Borrowed until {borrowUntil}</span>}
        <div className='listing-card-info'>
          <h3 className='listing-card-title'>{listing.title}</h3>
          <p className="listing-card-desc">{listing.description}</p>
          <span className="listing-card-price">{priceLabel}</span>
        </div>
        <button className="listing-card-btn" onClick={handleClick} aria-label={`More details about ${listing.title}`}>
          More details
        </button>
      </div>
    </div>
  )
}
