import express from 'express'
import { pool } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// ==========================================
// PATCH /api/purchase-requests/:id/decision
// ==========================================
router.patch('/:id/decision', requireAuth, async (req, res) => {
  const client = await pool.connect(); 
  
  try {
    const requestId = req.params.id;
    const { decision } = req.body; 

    const authId = req.auth.payload.sub;
    const userRes = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const userId = userRes.rows[0].user_id;

    // Verify ownership and get the listing_id
    const checkSql = `
      SELECT l.owner_id, pr.listing_id 
      FROM purchase_requests pr
      JOIN listings l ON pr.listing_id = l.listing_id
      WHERE pr.request_id = $1
    `;
    const checkRes = await client.query(checkSql, [requestId]);
    
    if (!checkRes.rows[0]) return res.status(404).json({ error: "Request not found" });
    if (checkRes.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: "Unauthorized: Only the owner can approve this." });
    }

    const listingId = checkRes.rows[0].listing_id;

    // --- START TRANSACTION ---
    await client.query('BEGIN');

    // Update the specific request
    const updateSql = `
      UPDATE purchase_requests 
      SET status = $1, responded_at = NOW() 
      WHERE request_id = $2 
      RETURNING *
    `;
    const { rows } = await client.query(updateSql, [decision, requestId]);
    const updatedRequest = rows[0];

    // 2. If ACCEPTED, auto-reject others AND mark the listing as SOLD
    if (decision === 'ACCEPTED') {
      // Auto-reject other pending requests
      const rejectOthersSql = `
        UPDATE purchase_requests
        SET status = 'REJECTED', responded_at = NOW()
        WHERE listing_id = $1 
          AND request_id != $2 
          AND status = 'PENDING'
      `;
      await client.query(rejectOthersSql, [listingId, requestId]);
      
      const markSoldSql = `
        UPDATE listings
        SET status = 'SOLD'
        WHERE listing_id = $1
      `;
      await client.query(markSoldSql, [listingId]);
    }

    await client.query('COMMIT');
    // --- END TRANSACTION ---

    res.json(updatedRequest);
  } catch (error) {
    await client.query('ROLLBACK'); // Cancel changes if anything crashed
    console.error("Error updating purchase request:", error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release(); // Return the client to the pool
  }
})

export default router