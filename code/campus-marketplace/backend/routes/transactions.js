import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/db.js'

const router = Router()

// ==========================================
// GET /api/transactions/mine
// ==========================================
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub;

    // Get the internal integer user_id
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    
    // If the user hasn't finished setting up their profile yet, return an empty array
    if (!userRes.rows[0]) {
      return res.json([]); 
    }
    const internalUserId = userRes.rows[0].user_id;

    // Fetch transactions where this user is either the buyer or the seller
    const { rows } = await pool.query(
      `SELECT t.*, l.title AS listing_title,
              EXISTS (SELECT 1 FROM reviews r WHERE r.transaction_id = t.transaction_id AND r.reviewer_id = $1) AS has_review
       FROM transactions t 
       JOIN listings l ON l.listing_id = t.listing_id
       WHERE t.buyer_id = $1 OR t.seller_id = $1
       ORDER BY t.created_at DESC`,
      [internalUserId]
    )
    
    res.json(rows)
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
})

// ==========================================
// PATCH /api/transactions/:id/complete
// ==========================================
router.patch('/:id/complete', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: users } = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [req.auth.payload.sub])
    if (!users[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }) }
    const { rows: transactions } = await client.query(
      'SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE', [req.params.id],
    )
    const transaction = transactions[0]
    if (!transaction) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transaction not found' }) }
    if (![transaction.buyer_id, transaction.seller_id].some((id) => String(id) === String(users[0].user_id))) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Only a participant can complete this transaction.' })
    }
    if (transaction.status !== 'PENDING') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'This transaction has already been completed.' })
    }
    const { rows } = await client.query(
      `UPDATE transactions SET status = 'COMPLETED', completed_at = NOW()
       WHERE transaction_id = $1 AND status = 'PENDING' RETURNING *`, [req.params.id],
    )
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error("Error completing transaction:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally { client.release() }
})

export default router
