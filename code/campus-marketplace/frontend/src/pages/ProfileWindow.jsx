import { useEffect, useState } from 'react'
import { useAuth0, withAuthenticationRequired } from '@auth0/auth0-react'
import { getCurrentUser, updateCurrentUser, getMyListings, getIncomingRequests, getOutgoingRequests, decidePurchaseRequest, decideBorrowing, deleteListing } from '../api/api'
import { useNavigate, Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import './ProfileWindow.css'

function ProfileWindow() {
  const [profile, setProfile] = useState(null)
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', contact_info: '' })
  const [saving, setSaving] = useState(false)
  const { user: auth0user } = useAuth0()
  const { user: auth0User, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate();

  const loadProfile = async () => {
    setLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const [user, listings, incoming, outgoing] = await Promise.all([
        getCurrentUser(token, auth0User),
        getMyListings(token),
        getIncomingRequests(token),
        getOutgoingRequests(token)
      ])

      setProfile({ ...user, listings })
      setForm({ name: user.name || '', contact_info: user.contact_info || '' })
      setIncomingRequests(incoming || [])
      setOutgoingRequests(outgoing || [])
    } catch (error) {
     console.error("Failed to load profile:", error)
    } finally {
     setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      const updated = await updateCurrentUser(form, token)
      setProfile((prev) => ({ ...prev, ...updated }))
      setEditing(false)
    } catch (error) {
      console.error("Error saving profile:",error)
      alert("Failed to save profile!")
    } finally {
      setSaving(false)
    }
  }

  const handleDecision = async (requestId, type, decision) => {
    try {
      const token = await getAccessTokenSilently()
      
      // Route to the correct backend patch function based on listing type
      if (type === 'SELL') {
        await decidePurchaseRequest(requestId, decision, token)
      } else {
        await decideBorrowing(requestId, decision, token)
      }

      // Update the local state instantly so the UI reflects the new status
      setIncomingRequests(prevRequests => {
        // Find the specific request we just clicked
        const targetRequest = prevRequests.find(r => r.id === requestId)

        return prevRequests.map(req => {
          // 1. Update the exact request we clicked
          if (req.id === requestId) {
            return { ...req, status: decision }
          }
          
          // 2. Auto-reject others! 
          // If we approved a sale, find all other pending requests for this same item and reject them
          if (
            (decision === 'ACCEPTED' || decision === 'BOOKED') && 
            req.title === targetRequest?.title && 
            req.status === 'PENDING'
          ) {
            return { ...req, status: 'REJECTED' }
          }

          // 3. Keep all other requests exactly the same
          return req
        })
      })
    } catch (error) {
      console.error(`Failed to mark request as ${decision}:`, error)
      alert("Something went wrong processing that request.")
    }
  }

  const handleDeleteListing = async (listingId) => {
    // 1. Ask for confirmation
    const isConfirmed = window.confirm("Are you sure you want to delete this listing? This cannot be undone.");
    if (!isConfirmed) return;

    try {
      const token = await getAccessTokenSilently();
      
      // 2. Tell the backend to delete it
      await deleteListing(listingId, token);

      // 3. THE FIX: Update the profile state to remove the listing instantly
      setProfile(prevProfile => ({
        ...prevProfile,
        listings: prevProfile.listings.filter(l => l.listing_id !== listingId)
      }));
      
      alert("Listing deleted.");
    } catch (error) {
      console.error("Failed to delete listing:", error);
      // If we get a 404, it probably means it was already deleted!
      if (error.response && error.response.status === 404) {
        alert("This listing was already deleted.");
        // Clean it up from the screen anyway
        setProfile(prevProfile => ({
          ...prevProfile,
          listings: prevProfile.listings.filter(l => l.listing_id !== listingId)
        }));
      } else {
        alert("Something went wrong trying to delete that listing.");
      }
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading profile..." />

  return (
    <div className="profile-window">
      <Link to="/browse" className="description-back">
        &larr; Back to listings
      </Link>
      <h1>Your Profile</h1>

      <section className="profile-card">
        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSave}>
            <label htmlFor="profile-name">
              Name
              <input
                id="profile-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your name"
              />
            </label>
            <label htmlFor="profile-phone">
              Phone
              <input
                id="profile-phone"
                type="text"
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="Enter your phone number"
              />
            </label>
            <div className="profile-edit-actions">
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving && <LoadingSpinner />}
                Save Changes
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="profile-field">
              <span className="profile-label">Name</span>
              <span>{profile?.name || '—'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">Email</span>
              <span>{auth0user?.email}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">Phone</span>
              <span>{profile?.contact_info || '—'}</span>
            </div>
            <button className="profile-edit-btn" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
          </>
        )}
      </section>

      <section>
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Your Listings</h2>
          <button 
              className="profile-save-btn" 
              onClick={() => navigate('/create-listing')}
            >
              + Create New Listing
            </button>
        </div>
        {profile?.listings?.length ? (
          <ul className="profile-list">
            {profile.listings.map((l) => (
              <li 
                key={l.listing_id} 
                className="clickable-card" 
                onClick={() => navigate(`/listing/${l.listing_id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                {/* Title and Price Group */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <span>{l.title}</span>
                  <span className="profile-price">
                    {l.type === 'BORROW' ? `₹${l.price_per_day}/day` : `₹${l.price}`}
                  </span>
                </div>

                {/* Delete Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // <-- CRITICAL: Stops the card from navigating!
                    handleDeleteListing(l.listing_id);
                  }}
                  style={{ 
                    backgroundColor: '#EA1B23', 
                    color: 'white', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">You haven't posted any listings yet.</p>
        )}
      </section>

      <section className="profile-section">
        <div className="section-header" style={{ borderBottom: 'none' }}>
          <h2>Your Requests</h2>
        </div>

        <div className="requests-container">
          
          {/* INCOMING */}
          <div className="request-column">
            <h3>Received Requests</h3>
            {incomingRequests?.length > 0 ? (
              incomingRequests.map(req => (
                <div key={req.id} className="request-card incoming">
                  <p>
                    <strong>{req.requester_name}</strong> wants to {req.type === 'SELL' ? 'buy' : 'borrow'} your <strong>{req.title}</strong>
                  </p>
                  
                  {/* Show buttons if PENDING, otherwise show the status badge */}
                  {req.status === 'PENDING' ? (
                    <div className="request-actions">
                      <button 
                        className="btn-approve" 
                        onClick={() => handleDecision(req.id, req.type, req.type === 'SELL' ? 'ACCEPTED' : 'BOOKED')}
                      >
                        Approve
                      </button>
                      <button 
                        className="btn-reject" 
                        onClick={() => handleDecision(req.id, req.type, 'REJECTED')}
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className={`status-badge ${req.status?.toLowerCase()}`}>
                      {req.status}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="profile-empty">No pending requests for your items.</p>
            )}
          </div>

          {/* OUTGOING */}
          <div className="request-column">
            <h3>Sent Requests</h3>
            {outgoingRequests?.length > 0 ? (
              outgoingRequests.map(req => (
                <div key={req.id} className="request-card outgoing">
                  <p>You requested to {req.type === 'SELL' ? 'buy' : 'borrow'} <strong>{req.title}</strong> from <strong>{req.owner_name}</strong></p>
                  <span className={`status-badge ${req.status?.toLowerCase()}`}>
                    {req.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="profile-empty">You haven't made any requests yet.</p>
            )}
          </div>

        </div>
      </section>
    </div>
  )
}

export default withAuthenticationRequired(ProfileWindow, {
  onRedirecting: () => <LoadingSpinner fullPage label="Redirecting to login..." />,
})