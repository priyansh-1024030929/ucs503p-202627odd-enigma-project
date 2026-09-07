import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { createListing } from '../api/api'
import { useRef } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import './CreateListing.css'

export default function CreateListing() {
  const { getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()
  
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '1', // Default category
    type: 'SELL',
    price: '',
    price_per_day: ''
  })
  const fileInputRef = useRef(null)

  // Handle file selection
  const handleImageChange = (e) => {
    // Convert FileList to an array
    setImages(Array.from(e.target.files))
  }

  const removeImage = (indexToRemove) => {
    // 1. Update React state
    const updatedImages = images.filter((_, index) => index !== indexToRemove)
    setImages(updatedImages)

    // 2. Force the HTML input to update its "X files selected" text
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      updatedImages.forEach(file => dataTransfer.items.add(file))
      fileInputRef.current.files = dataTransfer.files
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      
      // 1. Create a FormData object to hold text AND files
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('category_id', form.category_id)
      formData.append('type', form.type)
      
      if (form.type === 'SELL') {
        formData.append('price', form.price)
      } else {
        formData.append('price_per_day', form.price_per_day)
      }

      // 2. Loop through the images array and append each file
      images.forEach((image) => {
        formData.append('images', image)
      })

      // 3. Send the FormData to the API!
      await createListing(formData, token)
      
      alert("Listing created successfully!")
      navigate('/profile')
    } catch (error) {
      console.error("Failed to create listing:", error)
      alert("Failed to create listing. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="create-listing-window">
      <h1>Create a New Listing</h1>
      
      <form className="create-listing-form" onSubmit={handleSubmit}>
        
        <label>
          Title
          <input type="text" required maxLength="100" placeholder="Name of the Item"
            value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
        </label>

        <label>
          Category
          <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
            <option value="1">Books</option>
            <option value="2">Electronics</option>
            <option value="3">Stationery</option>
            <option value="4">Furniture</option>
            <option value="5">Clothing</option>
            <option value="6">Other</option>
          </select>
        </label>

        <label>
          Listing Type
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="SELL">For Sale</option>
            <option value="BORROW">For Rent / Borrow</option>
          </select>
        </label>

        {/* Dynamic Price Field */}
        {form.type === 'SELL' ? (
          <label>
            Price (₹)
            <input type="number" required min="0" step="0.01"
              value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
          </label>
        ) : (
          <label>
            Price Per Day (₹)
            <input type="number" required min="0" step="0.01"
              value={form.price_per_day} onChange={e => setForm({...form, price_per_day: e.target.value})} />
          </label>
        )}

        <label>
          Description
          <textarea required rows="4" placeholder="Condition, dimensions, pickup details..."
            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </label>

        <div className="file-upload-section">
          <label className="file-upload-label">
            Upload Images (Max 5)
            <input type="file" multiple accept="image/*" onChange={handleImageChange} ref={fileInputRef} />
          </label>

          {/* NEW: Display the list of selected files with a remove button */}
          {images.length > 0 && (
            <ul className="selected-files-list">
              {images.map((file, index) => (
                <li key={index} className="selected-file-item">
                  <span className="file-name">{file.name}</span>
                  {/* CRITICAL: type="button" prevents it from accidentally submitting the form! */}
                  <button 
                    type="button" 
                    className="remove-file-btn" 
                    onClick={() => removeImage(index)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="submit-listing-btn" disabled={saving}>
          {saving && <LoadingSpinner />}
          Post Listing
        </button>
      </form>
    </div>
  )
}