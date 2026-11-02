import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body
  if (!['ACTIVE', 'RETURNED'].includes(status)) return res.status(400).json({ error: 'Choose a valid borrowing status.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: users } = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!users[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }) }
    const { rows } = await client.query(
      `SELECT b.borrowing_id, b.borrower_id, b.status AS current_status, l.owner_id
       FROM borrowings b JOIN listings l ON l.listing_id = b.listing_id
       WHERE b.borrowing_id = $1 FOR UPDATE OF b`, [req.params.id],
    )
    const borrowing = rows[0]
    if (!borrowing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Borrowing not found' }) }
    const userId = String(users[0].user_id)
    const ownerId = String(borrowing.owner_id)
    const borrowerId = String(borrowing.borrower_id)
    const allowed = status === 'ACTIVE'
      ? userId === ownerId && borrowing.current_status === 'BOOKED'
      : userId === borrowerId && borrowing.current_status === 'ACTIVE'
    if (!allowed) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This borrowing status cannot be changed by you right now.' }) }
    const { rows: updated } = await client.query(
      'UPDATE borrowings SET status = $2 WHERE borrowing_id = $1 RETURNING *', [req.params.id, status],
    )
    await client.query('COMMIT')
    res.json(updated[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating borrowing status:', error)
    res.status(500).json({ error: 'Could not update borrowing status' })
  } finally { client.release() }
})

router.patch('/:id/decision', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    const accept = ['ACCEPT', 'ACCEPTED', 'BOOKED'].includes(req.body.decision)
    if (!accept && !['REJECT', 'REJECTED'].includes(req.body.decision)) return res.status(400).json({ error: 'Choose whether to accept or reject this request.' })
    await client.query('BEGIN')
    const me = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!me.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }) }
    const { rows: borrowingRows } = await client.query('SELECT listing_id FROM borrowings WHERE borrowing_id = $1', [req.params.id])
    if (!borrowingRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Borrowing request not found' }) }
    const listingId = borrowingRows[0].listing_id
    const { rows: listingRows } = await client.query('SELECT owner_id, status FROM listings WHERE listing_id = $1 FOR UPDATE', [listingId])
    if (!listingRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }) }
    if (String(listingRows[0].owner_id) !== String(me.rows[0].user_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the listing owner can decide this request.' }) }
    const { rows: targetRows } = await client.query(
      'SELECT status, start_time, end_time FROM borrowings WHERE borrowing_id = $1 AND listing_id = $2 FOR UPDATE',
      [req.params.id, listingId],
    )
    const target = targetRows[0]
    if (!target || target.status !== 'PENDING') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been decided.' }) }
    if (!accept) {
      const { rows } = await client.query(`UPDATE borrowings SET status = 'REJECTED', responded_at = NOW() WHERE borrowing_id = $1 AND status = 'PENDING' RETURNING *`, [req.params.id])
      await client.query('COMMIT')
      return res.json(rows[0])
    }
    if (listingRows[0].status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This listing is no longer active.' }) }
    if (new Date(target.start_time).getTime() < Date.now()) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This requested borrowing period has already started. Ask the requester to submit new dates.' }) }
    const { rows: conflicts } = await client.query(
      `SELECT borrowing_id FROM borrowings
       WHERE listing_id = $1 AND borrowing_id <> $2 AND status IN ('BOOKED', 'ACTIVE')
         AND start_time < $4 AND end_time > $3 LIMIT 1`,
      [listingId, req.params.id, target.start_time, target.end_time],
    )
    if (conflicts.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Another accepted borrowing overlaps those dates.' }) }
    const { rows } = await client.query(
      `UPDATE borrowings SET status = 'BOOKED', responded_at = NOW()
       WHERE borrowing_id = $1 AND status = 'PENDING' RETURNING *`, [req.params.id],
    )
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been decided.' }) }
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deciding borrowing:', error)
    res.status(500).json({ error: 'Could not update borrowing request' })
  } finally { client.release() }
})

export default router
