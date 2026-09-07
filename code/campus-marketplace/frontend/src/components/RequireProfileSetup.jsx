import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { getCurrentUser, registerUser } from '../api/api'
import LoadingSpinner from './LoadingSpinner'
import '../pages/ProfileWindow.css'

export default function RequireProfileSetup({ children }) {
  const { isAuthenticated, getAccessTokenSilently, user: auth0User, isLoading } = useAuth0()
  const [isRegistered, setIsRegistered] = useState(true)
  const [checking, setChecking] = useState(true)
  const [form, setForm] = useState({ name: '', contact_info: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // 1. Wait for Auth0 to finish loading
    if (isLoading) return;

    // 2. If they aren't logged in, let them browse the site normally
    if (!isAuthenticated) {
      setChecking(false)
      return
    }

    // 3. If they are logged in, check if they exist in PostgreSQL
    const verifyDatabaseRecord = async () => {
      try {
        const token = await getAccessTokenSilently()
        const user = await getCurrentUser(token)
        
        if (!user) {
          // TRAP DOOR: User doesn't exist! Block the app and show the form.
          setIsRegistered(false)
          setForm({ 
            name: auth0User?.name || auth0User?.nickname || '', 
            contact_info: '' 
          })
        }
      } catch (error) {
        console.error("Error verifying user:", error)
      } finally {
        setChecking(false)
      }
    }

    verifyDatabaseRecord()
  }, [isAuthenticated, isLoading, getAccessTokenSilently, auth0User])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const token = await getAccessTokenSilently()
      // Send the form data PLUS their secure Auth0 email to the backend
      await registerUser({ ...form, email: auth0User.email }, token)
      
      // Success! Open the trap door and let them into the app!
      setIsRegistered(true) 
    } catch (error) {
      console.error("Registration failed:", error)
      alert("Failed to save profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || checking) {
    return <LoadingSpinner fullPage label="Verifying account..." />
  }

  // ==========================================
  // THE FORCED ONBOARDING SCREEN
  // ==========================================
  if (isAuthenticated && !isRegistered) {
    return (
      <div className="profile-window" style={{ marginTop: '80px' }}>
        <h1>Welcome to Campus Marketplace!</h1>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--profile-text-muted)' }}>
          Please complete your profile to continue.
        </p>

        <section className="profile-card">
          <form className="profile-edit-form" onSubmit={handleSubmit}>
            <label htmlFor="setup-name">
              Name
              <input
                id="setup-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </label>
            <label htmlFor="setup-phone">
              Phone Number
              <input
                id="setup-phone"
                type="text"
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="Enter your phone number"
                required
              />
            </label>
            <div className="profile-edit-actions">
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving && <LoadingSpinner />}
                Complete Profile
              </button>
            </div>
          </form>
        </section>
      </div>
    )
  }

  // ==========================================
  // If registered (or logged out), show the app!
  // ==========================================
  return children
}