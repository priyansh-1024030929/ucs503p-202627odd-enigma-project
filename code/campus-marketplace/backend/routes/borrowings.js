import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// ==========================================
// PATCH /api/borrowings/:id/decision
// ==========================================
router.patch('/:id/decision', requireAuth, async (req, res) => {
  try {
    const borrowingId = req.params.id;
    const { decision } = req.body; 

    // Get the logged-in user's DB ID
    const authId = req.auth.payload.sub;
    const userRes = await pool.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const userId = userRes.rows[0].user_id;

    // Verify ownership
    const checkSql = `
      SELECT l.owner_id 
      FROM borrowings b
      JOIN listings l ON b.listing_id = l.listing_id
      WHERE b.borrowing_id = $1
    `;
    const checkRes = await pool.query(checkSql, [borrowingId]);
    
    if (!checkRes.rows[0]) return res.status(404).json({ error: "Borrowing request not found" });
    if (checkRes.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: "Unauthorized: Only the owner can approve this." });
    }

    // Update the status and record the response time
    const updateSql = `
      UPDATE borrowings 
      SET status = $1, responded_at = NOW() 
      WHERE borrowing_id = $2 
      RETURNING *
    `;
    const { rows } = await pool.query(updateSql, [decision, borrowingId]);
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating borrowing:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

export default router