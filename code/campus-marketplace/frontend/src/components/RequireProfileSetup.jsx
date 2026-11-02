import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { getCurrentUser, registerUser } from '../api/api'
import LoadingSpinner from './LoadingSpinner'
import '../pages/ProfileWindow.css'
import { restoreReturnScroll } from '../auth/navigation'

export default function RequireProfileSetup({ children }) {
  const { isAuthenticated, getAccessTokenSilently, user: auth0User, isLoading } = useAuth0()
  const [isRegistered, setIsRegistered] = useState(true)
  const [checking, setChecking] = useState(true)
  const [form, setForm] = useState({ name: '', contact_info: '' })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !checking && isRegistered) {
      restoreReturnScroll(`${location.pathname}${location.search}${location.hash}`)
    }
  }, [isLoading, checking, isRegistered, location.pathname, location.search, location.hash])

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
    setFeedback('')
    if (form.contact_info && !/^\d{10}$/.test(form.contact_info)) {
      setFeedback('Phone number must contain exactly 10 digits, or leave it blank for now.')
      return
    }
    setSaving(true)
    
    try {
      const token = await getAccessTokenSilently()
      // Send the form data PLUS their secure Auth0 email to the backend
      await registerUser({ ...form, email: auth0User.email }, token)
      
      // Success! Open the trap door and let them into the app!
      setIsRegistered(true) 
    } catch (error) {
      console.error("Registration failed:", error)
      setFeedback(error.response?.data?.error || 'Could not save your profile. Please try again.')
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
          Add your name and phone if you like. You can browse without them and complete your profile before posting or requesting an item.
        </p>

        <section className="profile-card">
          <form className="profile-edit-form" onSubmit={handleSubmit}>
            {feedback && <p role="alert" className="description-error-msg">{feedback}</p>}
            <label htmlFor="setup-name">
              Name
              <input
                id="setup-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </label>
            <label htmlFor="setup-phone">
              Phone Number
              <input
                id="setup-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                autoComplete="tel-national"
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="Enter your phone number"
                aria-describedby="setup-phone-help"
              />
              <small id="setup-phone-help">Optional for browsing. Enter exactly 10 digits to use requests and listing tools.</small>
            </label>
            <div className="profile-edit-actions">
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving && <LoadingSpinner />}
                Save and continue
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
