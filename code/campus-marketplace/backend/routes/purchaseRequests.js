import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.patch('/:id/decision', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    const { decision } = req.body
    if (!['ACCEPTED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Choose an accepted or rejected request status.' })
    await client.query('BEGIN')
    const me = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!me.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }) }
    const { rows: requestRows } = await client.query('SELECT listing_id FROM purchase_requests WHERE request_id = $1', [req.params.id])
    if (!requestRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }) }
    const listingId = requestRows[0].listing_id
    const { rows: listingRows } = await client.query('SELECT owner_id, status FROM listings WHERE listing_id = $1 FOR UPDATE', [listingId])
    if (!listingRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }) }
    if (String(listingRows[0].owner_id) !== String(me.rows[0].user_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the listing owner can decide this request.' }) }
    const { rows: lockedRequests } = await client.query('SELECT status, buyer_id FROM purchase_requests WHERE request_id = $1 AND listing_id = $2 FOR UPDATE', [req.params.id, listingId])
    if (!lockedRequests[0] || lockedRequests[0].status !== 'PENDING') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been decided.' }) }
    if (decision === 'ACCEPTED') {
      if (listingRows[0].status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This listing is no longer available for purchase.' }) }
      const { rows: updated } = await client.query(
        `UPDATE purchase_requests SET status = 'ACCEPTED', responded_at = NOW()
         WHERE request_id = $1 AND status = 'PENDING' RETURNING *`, [req.params.id],
      )
      if (!updated[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been decided.' }) }
      await client.query(`UPDATE purchase_requests SET status = 'REJECTED', responded_at = NOW() WHERE listing_id = $1 AND request_id <> $2 AND status = 'PENDING'`, [listingId, req.params.id])
      await client.query(`UPDATE listings SET status = 'SOLD' WHERE listing_id = $1 AND status = 'ACTIVE'`, [listingId])
      await client.query(
        `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status)
         SELECT listing_id, $2, owner_id, price, 'PENDING'
         FROM listings WHERE listing_id = $1`,
        [listingId, lockedRequests[0].buyer_id],
      )
      await client.query('COMMIT')
      return res.json(updated[0])
    }
    const { rows } = await client.query(
      `UPDATE purchase_requests SET status = 'REJECTED', responded_at = NOW()
       WHERE request_id = $1 AND status = 'PENDING' RETURNING *`, [req.params.id],
    )
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating purchase request:', error)
    res.status(500).json({ error: 'Could not update purchase request' })
  } finally { client.release() }
})

export default router
