import { useEffect, useState } from 'react'
import SearchBar from '../components/SearchBar'
import FilterSidebar from '../components/FilterSidebar'
import ListingCard from '../components/ListingCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { getListings } from '../api/api'
import './MainWindow.css'

export default function MainWindow() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})

  const fetchListings = async (params) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getListings(params)
      // Ensure data is always an array
      setListings(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Could not load listings. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchListings({ query, ...filters })
  }, [query, filters])

  return (
    <div className="main-window">
      <FilterSidebar onApply={setFilters} loading={loading} />

      <div className="main-window-content">
        <h1>Browse listings</h1>
        <SearchBar onSearch={setQuery} loading={loading} />

        {loading && <LoadingSpinner fullPage label="Fetching listings..." />}
        {error && <p className="main-window-error">{error}</p>}
        {!loading && !error && listings.length === 0 && (
          <p className="main-window-empty">No listings match your search yet.</p>
        )}

        <div className="listing-grid">
          {!loading &&
            listings?.map((listing) => (
              <ListingCard key={listing.listing_id} listing={listing} />
            ))}
        </div>
      </div>
    </div>
  )
}