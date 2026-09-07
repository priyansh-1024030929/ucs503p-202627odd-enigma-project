import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { getListingById, createPurchaseRequest, createBorrowing, getErrorMessage, getCurrentUser } from '../api/api'
import LoadingSpinner from '../components/LoadingSpinner'
import './ListingDescription.css'

export default function ListingDescription() {
  const { id } = useParams()
  const { user, getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0()
  const [listing, setListing] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [error, setError] = useState(null)
  const [dates, setDates] = useState({ start: '', end: '' })
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const listingData = await getListingById(id)
        setListing(listingData)

        // If they are logged in, fetch their DB ID so we can check ownership
        if (isAuthenticated) {
          const token = await getAccessTokenSilently()
          const dbUser = await getCurrentUser(token, user)
          setCurrentUser(dbUser)
        }
      } catch (err) {
        console.error("Failed to fetch data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, isAuthenticated, getAccessTokenSilently, user])

  const handleBuyRequest = async () => {
    if (!isAuthenticated) return loginWithRedirect()
    setSubmitting(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      await createPurchaseRequest(listing.listing_id, token)
      setRequestSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBorrowRequest = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) return loginWithRedirect()
    setSubmitting(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      await createBorrowing({
        listing_id: listing.listing_id,
        start_time: new Date(dates.start).toISOString(),
        end_time: new Date(dates.end).toISOString(),
      }, token)
      setRequestSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading listing..." />
  if (!listing) return <p className="description-error">Listing not found.</p>

  const isOwner = currentUser?.user_id === listing.owner_id
  const images = listing?.images || []

  return (
    <div className="description-window">
      <Link to="/browse" className="description-back">
        &larr; Back to listings
      </Link>

      <div className="description-content">
        
      {/* --- IMAGE GALLERY --- */}
      <div className="description-gallery">
        {images.length > 0 ? (
          <>
            <div className="main-image-container">
              {/* Fallback to img.image_url if your backend sends objects instead of strings */}
              <img 
                src={images[currentImageIndex]?.image_url || images[currentImageIndex]} 
                alt="Listing" 
                className="main-image" 
              />
            </div>
            
            {/* Only show thumbnails if there is more than 1 image */}
            {images.length > 1 && (
              <div className="thumbnail-row">
                {images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.image_url || img}
                    alt={`Thumbnail ${idx}`}
                    className={`thumbnail ${idx === currentImageIndex ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(idx)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="main-image-container no-image">
            <p>No Images Available</p>
          </div>
        )}
      </div>

        <div className="description-details">
          {listing.status === 'SOLD' && (
          <div className="sold-badge">
            Sold Out
          </div>
        )}
          <span className="description-category">{listing.category_name}</span>
          <h1>{listing.title}</h1>
          <span className="description-price">
            {listing.type === 'BORROW' ? `₹${listing.price_per_day}/day` : `₹${listing.price}`}
          </span>
          <p className="description-text">{listing.description}</p>

          <div className="description-meta">
            <p>
              <strong>Owner:</strong> {listing.owner_name}
            </p>
          </div>

          {error && <p className="description-error-msg">{error}</p>}
          
          {isOwner ? (
            <div className="description-owner-message">
              <p className="owner-message-text"> This is your listing</p>
            </div>
          ) : listing.status === 'SOLD' ? (
            <button 
              className="description-contact-btn" 
              disabled 
              style={{ opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#555' }}
            >
              Item Sold
            </button>
          ) : requestSent ? (
            <p className="description-sent">Request sent ✓</p>
          ) : listing.type === 'SELL' ? (
            <button className="description-contact-btn" onClick={handleBuyRequest} disabled={submitting}>
              {submitting && <LoadingSpinner />}
              Request to buy
            </button>
          ) : (
            <form className="description-borrow-form" onSubmit={handleBorrowRequest}>
              <label>
                From
                <input
                  type="datetime-local"
                  required
                  value={dates.start}
                  onChange={(e) => setDates({ ...dates, start: e.target.value })}
                />
              </label>
              <label>
                To
                <input
                  type="datetime-local"
                  required
                  value={dates.end}
                  onChange={(e) => setDates({ ...dates, end: e.target.value })}
                />
              </label>
              <button type="submit" className="description-contact-btn" disabled={submitting}>
                {submitting && <LoadingSpinner />}
                Request to borrow
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}