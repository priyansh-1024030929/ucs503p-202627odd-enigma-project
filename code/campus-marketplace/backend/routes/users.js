import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/db.js'
import { validProfileInput } from '../middleware/profileValidation.js'

const router = Router()

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_id, name, email, contact_info FROM users WHERE auth_user_id = $1',
      [req.auth.payload.sub],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' })
    res.json(rows[0])
  } catch (error) {
    console.error('Error in GET /me:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, contact_info: phone } = req.body
    if (name === undefined && phone === undefined) return res.status(400).json({ error: 'Add a name or phone number to save.' })
    if (!validProfileInput(name, phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' })
    const existing = await pool.query('SELECT user_id, name, contact_info FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!existing.rows[0]) return res.status(404).json({ error: 'Profile not found in database' })
    const nextName = name === undefined ? existing.rows[0].name : (name.trim() || null)
    const nextPhone = phone === undefined ? existing.rows[0].contact_info : (phone || null)
    const { rows } = await pool.query(
      'UPDATE users SET name = $1, contact_info = $2 WHERE auth_user_id = $3 RETURNING user_id, name, email, contact_info',
      [nextName, nextPhone, req.auth.payload.sub],
    )
    res.json(rows[0])
  } catch (error) {
    console.error('Error in PATCH /me:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/search', async (req, res) => {
  const query = String(req.query.query || '').trim()
  if (query.length < 2) return res.json([])
  try {
    const { rows } = await pool.query(
      `SELECT user_id, name, email FROM users
       WHERE name ILIKE $1
       ORDER BY name ASC LIMIT 30`,
      [`%${query.replace(/[\\%_]/g, '\\$&')}%`],
    )
    res.json(rows)
  } catch (error) {
    console.error('Error searching users:', error)
    res.status(500).json({ error: 'Could not search members' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_id, name, email, contact_info FROM users WHERE user_id = $1',
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' })
    const { rows: listings } = await pool.query(
      `SELECT l.listing_id, l.title, l.description, l.type, l.price, l.price_per_day,
              l.status, l.category_id, c.name AS category_name,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.listing_id ORDER BY li.created_at ASC LIMIT 1) AS primary_image,
              current_borrow.end_time AS borrowed_until
       FROM listings l
       LEFT JOIN categories c ON c.category_id = l.category_id
       LEFT JOIN LATERAL (
         SELECT b.end_time FROM borrowings b
         WHERE b.listing_id = l.listing_id AND b.status IN ('BOOKED', 'ACTIVE')
           AND b.start_time <= NOW() AND b.end_time > NOW()
         ORDER BY b.end_time DESC LIMIT 1
       ) current_borrow ON TRUE
       WHERE l.owner_id = $1 AND l.status = 'ACTIVE'
       ORDER BY l.created_at DESC`,
      [req.params.id],
    )
    res.json({ ...rows[0], listings })
  } catch (error) {
    console.error('Error fetching public profile:', error)
    res.status(500).json({ error: 'Could not load profile' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name = '', email = '', contact_info = '' } = req.body
    if (!validProfileInput(name, contact_info)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' })
    const authId = req.auth.payload.sub
    const existing = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId])
    if (existing.rows[0]) return res.status(409).json({ error: 'Profile already exists. Refresh and try again.' })
    const { rows } = await pool.query(
      `INSERT INTO users (auth_user_id, name, email, contact_info)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, contact_info`,
      [authId, name.trim() || null, email.trim(), contact_info || null],
    )
    res.status(201).json(rows[0])
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Profile already exists. Refresh and try again.' })
    console.error('Error creating profile:', error)
    res.status(500).json({ error: 'Could not create profile' })
  }
})

export default router
