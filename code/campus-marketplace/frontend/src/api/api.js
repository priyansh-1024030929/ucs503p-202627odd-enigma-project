// =====================================================================
// API CLIENT
// =====================================================================
import axios from 'axios'

// Base URL of the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: API_BASE_URL })

// ---------------------------------------------------------------------
// TOKEN WIRING
// ---------------------------------------------------------------------
let getAccessToken = null
export const setAccessTokenGetter = (fn) => {
  getAccessToken = fn
}

api.interceptors.request.use(async (config) => {
  if (getAccessToken) {
    try {
      const token = await getAccessToken({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      })
      config.headers.Authorization = `Bearer ${token}`
    } catch {

    }
  }
  return config
})

export const getErrorMessage = (err) =>
  err.response?.data?.error || 'Something went wrong. Please try again.'

// =====================================================================
//  CURRENT USER
// =====================================================================

// GET /api/users/me
export const getCurrentUser = async (token) => {
  try {
    const response = await api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error
  }
}

// FUNCTION to handle forced form submission
export const registerUser = async (formData, token) => {
  const response = await api.post('/api/users', formData, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

// PUT /api/users/me — body: { name?, contact_info? }
export const updateCurrentUser = async (formData, token) => {
  const response = await api.put('/api/users/me', formData, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

// =====================================================================
//  LISTINGS
// =====================================================================

// GET /api/listings?query=&category_id=&type=&min_price=&max_price=
export const getListings = (filters = {}) =>
  api.get('/api/listings', { params: filters }).then((r) => r.data)

// GET /api/listings/:listingId 
export const getListingById = (listingId) =>
  api.get(`/api/listings/${listingId}`).then((r) => r.data)

// POST /api/listings
export const createListing = (data, token) => 
  api.post('/api/listings', data, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

// GET own listings.
export const getMyListings = (token) => 
  api.get('/api/listings/mine', {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

// DELETE a listing
export const deleteListing = (listingId, token) => 
  api.delete(`/api/listings/${listingId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

// =====================================================================
//  LISTING IMAGES
// =====================================================================

// POST /api/listings/:listingId/images (multipart/form-data)
export const uploadListingImage = (listingId, file) => {
  const formData = new FormData()
  formData.append('image', file)
  return api.post(`/api/listings/${listingId}/images`, formData).then((r) => r.data.image)
}

// DELETE /api/listings/:listingId/images/:imageId
export const deleteListingImage = (listingId, imageId) =>
  api.delete(`/api/listings/${listingId}/images/${imageId}`).then((r) => r.data)

// =====================================================================
//  BORROWINGS
// =====================================================================

export const createBorrowing = (data, token) =>
  api.post('/api/requests/borrow', data, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data.borrowing)

export const decideBorrowing = (borrowingId, decision, token) =>
  api.patch(`/api/borrowings/${borrowingId}/decision`, { decision }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

export const updateBorrowingStatus = (borrowingId, status, token) =>
  api.patch(`/api/borrowings/${borrowingId}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)


// =====================================================================
//  PURCHASE REQUESTS
// =====================================================================

export const createPurchaseRequest = (listingId, token) =>
  api.post('/api/requests/purchase', { listing_id: listingId }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

export const decidePurchaseRequest = (requestId, decision, token) =>
  api.patch(`/api/purchase-requests/${requestId}/decision`, { decision }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)


// =====================================================================
//  TRANSACTIONS
// =====================================================================

export const completeTransaction = (transactionId, token) =>
  // NOTE: Passed an empty object {} for the body so the headers don't get mixed up!
  api.patch(`/api/transactions/${transactionId}/complete`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

export const getMyTransactions = (token) => 
  api.get('/api/transactions/mine', {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)


// =====================================================================
//  REVIEWS
// =====================================================================

export const createTransactionReview = ({ transaction_id, rating, comment }, token) =>
  api.post('/api/reviews', { deal_type: 'T', transaction_id, rating, comment }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

export const createBorrowingReview = ({ borrowing_id, rating, comment }, token) =>
  api.post('/api/reviews', { deal_type: 'B', borrowing_id, rating, comment }, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)


// =====================================================================
//  PUBLIC PROFILE 
// =====================================================================

export const getUserPublicProfile = (userId) =>
  api.get(`/api/users/${userId}`).then((r) => r.data)

export default api

// Fetch requests where user is the owner of the listing
export const getIncomingRequests = (token) => 
  api.get('/api/requests/incoming', {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)

// Fetch requests where user is the requester
export const getOutgoingRequests = (token) => 
  api.get('/api/requests/outgoing', {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.data)