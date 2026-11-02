import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'
import { getAuthenticatedUser, profileIsComplete } from '../middleware/profileValidation.js'

const router = express.Router()

router.get('/incoming', requireAuth, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(pool, req.auth.payload.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { rows } = await pool.query(
      `SELECT pr.request_id AS id, 'SELL' AS type, pr.status, pr.created_at, l.listing_id, l.title,
              EXISTS (SELECT 1 FROM reviews r WHERE r.transaction_id IN (SELECT t.transaction_id FROM transactions t WHERE t.listing_id = l.listing_id AND t.buyer_id = pr.buyer_id) AND r.reviewer_id = $1) AS has_review,
              u.user_id AS requester_user_id, u.name AS requester_name, NULL::timestamptz AS start_time, NULL::timestamptz AS end_time
       FROM purchase_requests pr JOIN listings l ON l.listing_id = pr.listing_id JOIN users u ON u.user_id = pr.buyer_id
       WHERE l.owner_id = $1
       UNION ALL
       SELECT b.borrowing_id AS id, 'BORROW' AS type, b.status, b.created_at, l.listing_id, l.title,
              EXISTS (SELECT 1 FROM reviews r WHERE r.borrowing_id = b.borrowing_id AND r.reviewer_id = $1) AS has_review,
              u.user_id AS requester_user_id, u.name AS requester_name, b.start_time, b.end_time
       FROM borrowings b JOIN listings l ON l.listing_id = b.listing_id JOIN users u ON u.user_id = b.borrower_id
       WHERE l.owner_id = $1 ORDER BY created_at DESC`,
      [user.user_id],
    )
    res.json(rows)
  } catch (error) {
    console.error('Error fetching incoming requests:', error)
    res.status(500).json({ error: 'Could not load incoming requests' })
  }
})

router.get('/outgoing', requireAuth, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(pool, req.auth.payload.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { rows } = await pool.query(
      `SELECT pr.request_id AS id, 'SELL' AS type, pr.status, pr.created_at, l.listing_id, l.title,
              EXISTS (SELECT 1 FROM reviews r WHERE r.transaction_id IN (SELECT t.transaction_id FROM transactions t WHERE t.listing_id = l.listing_id AND t.buyer_id = pr.buyer_id) AND r.reviewer_id = $1) AS has_review,
              l.owner_id AS owner_user_id, u.name AS owner_name, NULL::timestamptz AS start_time, NULL::timestamptz AS end_time
       FROM purchase_requests pr JOIN listings l ON l.listing_id = pr.listing_id JOIN users u ON u.user_id = l.owner_id
       WHERE pr.buyer_id = $1
       UNION ALL
       SELECT b.borrowing_id AS id, 'BORROW' AS type, b.status, b.created_at, l.listing_id, l.title,
              EXISTS (SELECT 1 FROM reviews r WHERE r.borrowing_id = b.borrowing_id AND r.reviewer_id = $1) AS has_review,
              l.owner_id AS owner_user_id, u.name AS owner_name, b.start_time, b.end_time
       FROM borrowings b JOIN listings l ON l.listing_id = b.listing_id JOIN users u ON u.user_id = l.owner_id
       WHERE b.borrower_id = $1 ORDER BY created_at DESC`,
      [user.user_id],
    )
    res.json(rows)
  } catch (error) {
    console.error('Error fetching outgoing requests:', error)
    res.status(500).json({ error: 'Could not load sent requests' })
  }
})

router.post('/purchase', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const user = await getAuthenticatedUser(client, req.auth.payload.sub)
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User profile not found' }) }
    if (!profileIsComplete(user)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Add your name and a valid 10-digit phone number before requesting an item.' }) }
    const { listing_id } = req.body
    const { rows: listings } = await client.query('SELECT listing_id, owner_id, type, status FROM listings WHERE listing_id = $1 FOR UPDATE', [listing_id])
    const listing = listings[0]
    if (!listing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }) }
    if (String(listing.owner_id) === String(user.user_id)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'You cannot buy your own listing.' }) }
    if (listing.type !== 'SELL' || listing.status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This listing is no longer available to buy.' }) }
    const { rows } = await client.query(
      `INSERT INTO purchase_requests (listing_id, buyer_id, status) VALUES ($1, $2, 'PENDING') RETURNING *`,
      [listing_id, user.user_id],
    )
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating purchase request:', error)
    res.status(500).json({ error: 'Could not submit purchase request' })
  } finally { client.release() }
})

router.post('/borrow', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    const { listing_id, start_time, end_time } = req.body
    const start = new Date(start_time)
    const end = new Date(end_time)
    if (!start_time || !end_time || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return res.status(400).json({ error: 'Enter valid borrow start and end dates.' })
    if (start.getTime() < Date.now()) return res.status(400).json({ error: 'The borrow start date cannot be in the past.' })
    if (end <= start) return res.status(400).json({ error: 'The borrow end date must be after the start date.' })
    await client.query('BEGIN')
    const user = await getAuthenticatedUser(client, req.auth.payload.sub)
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User profile not found' }) }
    if (!profileIsComplete(user)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Add your name and a valid 10-digit phone number before requesting an item.' }) }
    const { rows: listings } = await client.query('SELECT listing_id, owner_id, type, status FROM listings WHERE listing_id = $1 FOR UPDATE', [listing_id])
    const listing = listings[0]
    if (!listing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }) }
    if (String(listing.owner_id) === String(user.user_id)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'You cannot borrow your own listing.' }) }
    if (listing.type !== 'BORROW' || listing.status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This listing is no longer available to borrow.' }) }
    const { rows: currentlyBorrowed } = await client.query(
      `SELECT end_time FROM borrowings
       WHERE listing_id = $1 AND status IN ('BOOKED', 'ACTIVE')
         AND start_time <= NOW() AND end_time > NOW() LIMIT 1`,
      [listing_id],
    )
    if (currentlyBorrowed.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `This item is currently borrowed until ${new Date(currentlyBorrowed[0].end_time).toLocaleString()}.` })
    }
    const { rows: conflicts } = await client.query(
      `SELECT borrowing_id FROM borrowings
       WHERE listing_id = $1 AND status IN ('BOOKED', 'ACTIVE')
         AND start_time < $3 AND end_time > $2 AND end_time > NOW()
       LIMIT 1`,
      [listing_id, start.toISOString(), end.toISOString()],
    )
    if (conflicts.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Those dates overlap an accepted borrowing. Choose another date range.' }) }
    const { rows } = await client.query(
      `INSERT INTO borrowings (listing_id, borrower_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
      [listing_id, user.user_id, start.toISOString(), end.toISOString()],
    )
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating borrow request:', error)
    res.status(500).json({ error: 'Could not submit borrow request' })
  } finally { client.release() }
})

export default router
