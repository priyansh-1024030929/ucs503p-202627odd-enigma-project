// Top-level app: renders the Navbar on every page and defines the routes
// for the three main windows. ProfileWindow guards itself with Auth0's
// withAuthenticationRequired (see pages/ProfileWindow.jsx) instead of a
// separate <ProtectedRoute> wrapper.
import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import HomePage from './pages/HomePage'
import Navbar from './components/Navbar'
import MainWindow from './pages/MainWindow'
import ListingDescription from './pages/ListingDescription'
import ProfileWindow from './pages/ProfileWindow'
import RequireProfileSetup from './components/RequireProfileSetup'
import CreateListing from './pages/CreateListing'
import { setAccessTokenGetter } from './api/api'
import './App.css'

export default function App() {
  const { getAccessTokenSilently } = useAuth0()

  // One-time wiring so api.js can silently attach a fresh Auth0 token to
  // every outgoing request without every component fetching it manually.
  useEffect(() => {
    setAccessTokenGetter(getAccessTokenSilently)
  }, [getAccessTokenSilently])

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route 
            path="/*" 
            element={
              <RequireProfileSetup>
                <Routes>
                 <Route path="/browse" element={<MainWindow />} />
                  <Route path="/listing/:id" element={<ListingDescription />} />
                  <Route path="/profile" element={<ProfileWindow />} />
                  <Route path="/create-listing" element={<CreateListing />} />
                </Routes>
              </RequireProfileSetup>
            } 
          />
        </Routes>
      </main>
    </>
  )
}
