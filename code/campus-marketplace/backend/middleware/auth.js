// =====================================================================
// AUTH0 JWT VERIFICATION
// =====================================================================
import { auth } from 'express-oauth2-jwt-bearer'

export const requireAuth = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
})
