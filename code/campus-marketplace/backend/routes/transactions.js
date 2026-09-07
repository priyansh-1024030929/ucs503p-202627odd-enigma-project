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
      `SELECT t.*, l.title AS listing_title
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
// POST /api/transactions
// ==========================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub;
    const { listing_id, seller_id, amount, status } = req.body;

    // Get the internal buyer_id from Auth0 token
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(401).json({ error: 'User not found' });
    
    const buyer_id = userRes.rows[0].user_id;

    const { rows } = await pool.query(
      `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [listing_id, buyer_id, seller_id, amount, status || 'PENDING']
    )
    
    res.status(201).json(rows[0])
  } catch (err) {
    console.error("Error creating transaction:", err);
    res.status(500).json({ error: "Internal server error" });
  }
})

export default router