import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/db.js' 

const router = Router()

// ==========================================
// GET /api/users/me (YOUR private profile)
// ==========================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub
    const { rows } = await pool.query('SELECT * FROM users WHERE auth_user_id = $1', [authId]);
    
    if (!rows[0]) {
      return res.status(404).json({ error: 'Profile not found' })
    }
    
    res.json(rows[0])
  } catch (error) {
    console.error("Error in GET /me:", error);
    res.status(500).json({ error: "Server error" });
  }
})

// ==========================================
// PUT /api/users/me (EDIT your profile)
// ==========================================
router.put('/me', requireAuth, async (req, res) => {
  try{
    const authId = req.auth.payload.sub;
    const { name, contact_info } = req.body;

    const { rows } = await pool.query(
      'UPDATE users SET name = $1, contact_info = $2 WHERE auth_user_id = $3 RETURNING *',
      [name, contact_info, authId]
    );

    if(!rows[0]) {
      return res.status(404).json({ error: 'Profile not found in database' });
    }
    
    res.json(rows[0]);
  } catch(error) {
    console.error("Error in PUT /me:",error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// GET /api/users/:id (OTHER users' public profiles)
// ==========================================
router.get('/:id', async (req, res) => {
  // Uses req.params.id (the URL parameter) instead of the Auth0 token
  const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
  const { rows: listings } = await pool.query('SELECT * FROM listings WHERE seller_id = $1', [req.params.id]);
  
  if (!rows[0]) {
    return res.status(404).json({ error: 'Profile not found' }); 
  }
  
  res.json({ ...rows[0], listings });
});

// ==========================================
// POST /api/users (CREATE profile on first login)
// ==========================================
router.post('/', requireAuth, async (req, res) => {
  const authId = req.auth.payload.sub;
  const { name, email, contact_info } = req.body;

  const { rows } = await pool.query(
    'INSERT INTO users (auth_user_id, name, email, contact_info) VALUES ($1, $2, $3, $4) RETURNING *',
    [authId, name, email, contact_info]
  );
  
  res.status(201).json(rows[0]);
});

export default router;