import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/db.js'

const router = Router()

router.post('/', requireAuth, async (req, res) => {
  const { deal_type: dealType, transaction_id: transactionId, borrowing_id: borrowingId, rating, comment = '' } = req.body
  if (!['T', 'B'].includes(dealType) || (dealType === 'T' ? !transactionId || borrowingId : !borrowingId || transactionId)) {
    return res.status(400).json({ error: 'Choose exactly one completed transaction or returned borrowing to review.' })
  }
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' })
  }
  if (typeof comment !== 'string' || comment.trim().length > 1000) {
    return res.status(400).json({ error: 'Review comments must be 1,000 characters or fewer.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: users } = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!users[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }) }
    const reviewerId = users[0].user_id
    let revieweeId

    if (dealType === 'T') {
      const { rows } = await client.query(
        `SELECT buyer_id, seller_id, status FROM transactions WHERE transaction_id = $1 FOR UPDATE`, [transactionId],
      )
      const transaction = rows[0]
      if (!transaction) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transaction not found' }) }
      if (![transaction.buyer_id, transaction.seller_id].some((id) => String(id) === String(reviewerId))) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only a transaction participant can leave a review.' })
      }
      if (transaction.status !== 'COMPLETED') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Complete the transaction before reviewing it.' }) }
      revieweeId = String(transaction.buyer_id) === String(reviewerId) ? transaction.seller_id : transaction.buyer_id
    } else {
      const { rows } = await client.query(
        `SELECT b.borrower_id, l.owner_id, b.status
         FROM borrowings b JOIN listings l ON l.listing_id = b.listing_id
         WHERE b.borrowing_id = $1 FOR UPDATE OF b`, [borrowingId],
      )
      const borrowing = rows[0]
      if (!borrowing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Borrowing not found' }) }
      if (![borrowing.borrower_id, borrowing.owner_id].some((id) => String(id) === String(reviewerId))) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only a borrowing participant can leave a review.' })
      }
      if (borrowing.status !== 'RETURNED') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The item must be returned before reviewing the borrowing.' }) }
      revieweeId = String(borrowing.borrower_id) === String(reviewerId) ? borrowing.owner_id : borrowing.borrower_id
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO reviews (transaction_id, borrowing_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dealType === 'T' ? transactionId : null, dealType === 'B' ? borrowingId : null, reviewerId, revieweeId, Number(rating), comment.trim()],
    )
    await client.query('COMMIT')
    res.status(201).json(inserted[0])
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') return res.status(409).json({ error: 'You have already reviewed this completed deal.' })
    console.error('Error creating review:', error)
    res.status(500).json({ error: 'Could not submit review' })
  } finally {
    client.release()
  }
})

export default router
