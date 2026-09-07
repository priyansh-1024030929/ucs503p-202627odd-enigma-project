import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import './FilterSidebar.css'

// ---------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------
const CATEGORIES = [
  { id: '1', name: 'Books' },
  { id: '2', name: 'Electronics' },
  { id: '3', name: 'Stationery'},
  { id: '4', name: 'Furniture' },
  { id: '5', name: 'Clothing' },
  { id: '6', name: 'Other'}
]

const MIN_PRICE = 0
const MAX_PRICE = 5000

const EMPTY_FILTERS = {
  category_id: '',
  type: '',
  minPrice: MIN_PRICE,
  maxPrice: MAX_PRICE,
}

export default function FilterSidebar({ onApply, loading }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const update = (field) => (e) => setFilters({ ...filters, [field]: e.target.value })

  const handleMinChange = (e) => {
    const value = Math.min(Number(e.target.value), filters.maxPrice)
    setFilters({ ...filters, minPrice: value })
  }
  const handleMaxChange = (e) => {
    const value = Math.max(Number(e.target.value), filters.minPrice)
    setFilters({ ...filters, maxPrice: value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onApply({
      categoryId: filters.category_id,
      type: filters.type,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    })
  }

  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    onApply({ categoryId: '', type: '', minPrice: MIN_PRICE, maxPrice: MAX_PRICE })
  }

  return (
    <form className="filter-sidebar" onSubmit={handleSubmit}>
      <h2>Filters</h2>

      <label className="filter-field">
        Category
        <select value={filters.category_id} onChange={update('category_id')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        Listing type
        <select value={filters.type} onChange={update('type')}>
          <option value="">Sell + Borrow</option>
          <option value="SELL">For sale</option>
          <option value="BORROW">For borrowing</option>
        </select>
      </label>

      <div className="filter-field">
        Price range
        <span className="filter-price-values">
          ₹{filters.minPrice} – ₹{filters.maxPrice}
        </span>
        <div className="price-slider">
          <input
            type="range"
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={filters.minPrice}
            onChange={handleMinChange}
          />
          <input
            type="range"
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={filters.maxPrice}
            onChange={handleMaxChange}
          />
        </div>
      </div>

      <button type="submit" className="filter-apply-btn" disabled={loading}>
        {loading && <LoadingSpinner />}
        Apply filters
      </button>
      <button type="button" className="filter-reset-btn" onClick={handleReset} disabled={loading}>
        Reset
      </button>
    </form>
  )
}
