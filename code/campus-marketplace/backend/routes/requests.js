import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// ==========================================
// GET /api/requests/incoming
// ==========================================
router.get('/incoming', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId])
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" })
    const userId = userRes.rows[0].user_id

    const sql = `
      -- 1. Purchase Requests (Sell items)
      SELECT 
        pr.request_id AS id,
        l.type, -- 'SELL'
        pr.status, 
        pr.created_at,
        l.title, 
        u.name AS requester_name
      FROM purchase_requests pr
      JOIN listings l ON pr.listing_id = l.listing_id
      JOIN users u ON pr.buyer_id = u.user_id
      WHERE l.owner_id = $1

      UNION ALL

      -- 2. Borrowings (Borrow items)
      SELECT 
        b.borrowing_id AS id,
        l.type, -- 'BORROW'
        b.status, 
        b.created_at,
        l.title, 
        u.name AS requester_name
      FROM borrowings b
      JOIN listings l ON b.listing_id = l.listing_id
      JOIN users u ON b.borrower_id = u.user_id
      WHERE l.owner_id = $1

      ORDER BY created_at DESC
    `
    const { rows } = await pool.query(sql, [userId])
    res.json(rows)
  } catch (error) {
    console.error("Error fetching incoming requests:", error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ==========================================
// GET /api/requests/outgoing
// ==========================================
router.get('/outgoing', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId])
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" })
    const userId = userRes.rows[0].user_id

    const sql = `
      -- 1. Your Purchase Requests
      SELECT 
        pr.request_id AS id,
        l.type,
        pr.status, 
        pr.created_at,
        l.title, 
        u.name AS owner_name
      FROM purchase_requests pr
      JOIN listings l ON pr.listing_id = l.listing_id
      JOIN users u ON l.owner_id = u.user_id
      WHERE pr.buyer_id = $1

      UNION ALL

      -- 2. Your Borrow Requests
      SELECT 
        b.borrowing_id AS id,
        l.type,
        b.status, 
        b.created_at,
        l.title, 
        u.name AS owner_name
      FROM borrowings b
      JOIN listings l ON b.listing_id = l.listing_id
      JOIN users u ON l.owner_id = u.user_id
      WHERE b.borrower_id = $1

      ORDER BY created_at DESC
    `
    const { rows } = await pool.query(sql, [userId])
    res.json(rows)
  } catch (error) {
    console.error("Error fetching outgoing requests:", error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ==========================================
// POST /api/requests/purchase
// ==========================================
router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const { listing_id } = req.body;
    
    // Get the logged-in user's internal ID
    const authId = req.auth.payload.sub;
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const userId = userRes.rows[0].user_id;

    // Prevent the owner from buying their own item
    const listingRes = await pool.query('SELECT owner_id FROM listings WHERE listing_id = $1', [listing_id]);
    if (!listingRes.rows[0]) return res.status(404).json({ error: "Listing not found" });
    if (listingRes.rows[0].owner_id === userId) {
      return res.status(400).json({ error: "You cannot buy your own listing." });
    }

    // Insert the request (Default status is usually 'PENDING')
    const insertSql = `
      INSERT INTO purchase_requests (listing_id, buyer_id, status)
      VALUES ($1, $2, 'PENDING')
      RETURNING *
    `;
    const { rows } = await pool.query(insertSql, [listing_id, userId]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating purchase request:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// POST /api/requests/borrow
// ==========================================
router.post('/borrow', requireAuth, async (req, res) => {
  try {
    const { listing_id, start_time, end_time } = req.body;
    
    const authId = req.auth.payload.sub;
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const userId = userRes.rows[0].user_id;

    // Prevent owner from borrowing their own item
    const listingRes = await pool.query('SELECT owner_id FROM listings WHERE listing_id = $1', [listing_id]);
    if (!listingRes.rows[0]) return res.status(404).json({ error: "Listing not found" });
    if (listingRes.rows[0].owner_id === userId) {
      return res.status(400).json({ error: "You cannot borrow your own listing." });
    }

    
    const insertSql = `
      INSERT INTO borrowings (listing_id, borrower_id, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
    `;
    const { rows } = await pool.query(insertSql, [listing_id, userId, start_time, end_time]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating borrow request:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router