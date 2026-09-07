import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/db.js' 
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'

const router = Router()

// GET /api/listings (Used in MainWindow)
router.get('/', async (req, res) => {
  try {
    const { query = '', categoryId = '', type = '', sort = 'newest', minPrice = '', maxPrice = '' } = req.query
    const min = minPrice === '' ? 0 : Number(minPrice)
    const max = maxPrice === '' ? Number.MAX_SAFE_INTEGER : Number(maxPrice)

    let sql = `
      SELECT 
        l.*, 
        c.name AS category_name,
        u.name AS owner_name,
        (
          SELECT image_url 
          FROM listing_images li 
          WHERE li.listing_id = l.listing_id 
          ORDER BY created_at ASC 
          LIMIT 1
        ) as primary_image
      FROM listings l
      LEFT JOIN categories c ON l.category_id = c.category_id
      LEFT JOIN users u ON l.owner_id = u.user_id
      WHERE l.title ILIKE $1 
      AND COALESCE(l.price, l.price_per_day) BETWEEN $2 AND $3
    `
    const params = [`%${query}%`, min, max]

    if (categoryId) {
      params.push(categoryId)
      sql += ` AND l.category_id = $${params.length}`
    }
    if (type) {
      params.push(type)
      sql += ` AND l.type = $${params.length}`
    }

    if (sort === 'price_low') {
      sql += ` ORDER BY COALESCE(l.price, l.price_per_day) ASC`
    } else if (sort === 'price_high') {
      sql += ` ORDER BY COALESCE(l.price, l.price_per_day) DESC`
    } else {
      sql += ` ORDER BY l.created_at DESC`
    }

    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (error) {
    console.error("Error fetching listings:", error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ==========================================
// GET /api/listings/mine
// ==========================================
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const authId = req.auth.payload.sub;
    
    const { rows } = await pool.query(`
      SELECT l.* 
      FROM listings l
      JOIN users u ON l.owner_id = u.user_id 
      WHERE u.auth_user_id = $1
      ORDER BY l.created_at DESC
    `, [authId]);
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching my listings:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

// ==========================================
// GET /api/listings/:id
// ==========================================
// GET /api/listings/:id (Used in ListingDescription)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const sql = `
      SELECT 
        l.*,
        c.name AS category_name,
        u.name AS owner_name,
        COALESCE(
          (
            SELECT json_agg(image_url ORDER BY created_at ASC)
            FROM listing_images li
            WHERE li.listing_id = l.listing_id
          ),
          '[]'::json
        ) as images
      FROM listings l
      LEFT JOIN categories c ON l.category_id = c.category_id
      LEFT JOIN users u ON l.owner_id = u.user_id
      WHERE l.listing_id = $1
    `
    const { rows } = await pool.query(sql, [id])
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' })
    }
    res.json(rows[0])
  } catch (error) {
    console.error("Error fetching listing:", error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Configure Multer to hold files in memory temporarily
const upload = multer({ storage: multer.memoryStorage() })

// ==========================================
// POST /api/listings (CREATE LISTING & UPLOAD IMAGES)
// ==========================================
router.post('/', requireAuth, upload.array('images', 5), async (req, res) => {
  const client = await pool.connect()
  
  try {
    // START DB TRANSACTION
    await client.query('BEGIN') 
    
    const authId = req.auth.payload.sub
    const { title, description, category_id, type, price, price_per_day } = req.body

    // Get the internal user_id
    const userRes = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId])
    if (!userRes.rows[0]) throw new Error("User not found")
    const sellerId = userRes.rows[0].user_id

    // Insert the Listing
    const listingRes = await client.query(
      `INSERT INTO listings (owner_id, category_id, title, description, type, price, price_per_day) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING listing_id`,
      [sellerId, category_id, title, description, type, price || null, price_per_day || null]
    )
    const newListingId = listingRes.rows[0].listing_id

    // Upload Images to Supabase & Save URLs to Database
    let successfullyUploadedFiles = [] 

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`
        
        // Upload to the 'listing-images' bucket
        const { data, error } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype
          })

        if (error) throw error

        successfullyUploadedFiles.push(fileName) 

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName)

        // Insert into listing_images table
        await client.query(
          'INSERT INTO listing_images (listing_id, image_url) VALUES ($1, $2)',
          [newListingId, publicUrl]
        )
      }
    }

    // COMMIT: Save all database changes
    await client.query('COMMIT') 
    res.status(201).json({ message: 'Listing created successfully', listing_id: newListingId })

  } catch (error) {
    // CLEAN UP THE DATABASE WORLD
    await client.query('ROLLBACK') 
    console.error("Listing creation error:", error)

    // CLEAN UP THE STORAGE WORLD (The Compensating Transaction)
    if (successfullyUploadedFiles && successfullyUploadedFiles.length > 0) {
      console.log(`Deleting ${successfullyUploadedFiles.length} orphaned files from Supabase...`)
      
      const { error: cleanupError } = await supabase.storage
        .from('listing-images')
        .remove(successfullyUploadedFiles)
        
      if (cleanupError) {
        console.error("CRITICAL: Failed to clean up Supabase storage:", cleanupError)
      }
    }

    res.status(500).json({ error: 'Failed to create listing' })
  } finally {
    client.release()
  }
})

// ==========================================
// DELETE /api/listings/:id
// ==========================================
router.delete('/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const listingId = req.params.id;
    const authId = req.auth.payload.sub;

    // Get the internal user_id
    const userRes = await client.query('SELECT user_id FROM users WHERE auth_user_id = $1', [authId]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const userId = userRes.rows[0].user_id;

    // Verify ownership AND get the image URLs before we delete them
    const checkSql = `
      SELECT l.owner_id, 
             COALESCE(json_agg(li.image_url) FILTER (WHERE li.image_url IS NOT NULL), '[]') as images
      FROM listings l
      LEFT JOIN listing_images li ON l.listing_id = li.listing_id
      WHERE l.listing_id = $1
      GROUP BY l.listing_id
    `;
    const checkRes = await client.query(checkSql, [listingId]);
    
    if (!checkRes.rows[0]) return res.status(404).json({ error: "Listing not found" });
    if (checkRes.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: "Unauthorized: Only the owner can delete this." });
    }

    const imageUrls = checkRes.rows[0].images;

    // Delete from the Database (Manual Cascade)
    await client.query('DELETE FROM listing_images WHERE listing_id = $1', [listingId]);
    await client.query('DELETE FROM purchase_requests WHERE listing_id = $1', [listingId]);
    await client.query('DELETE FROM borrowings WHERE listing_id = $1', [listingId]);

    await client.query('DELETE FROM listings WHERE listing_id = $1', [listingId]);

    // Delete the files from Supabase Storage
    if (imageUrls && imageUrls.length > 0) {
      // Extract just the filenames from the long public URLs
      const fileNames = imageUrls.map(url => {
        const parts = url.split('/');
        return parts[parts.length - 1]; // Grabs the last part of the URL 
      });

      const { error: storageError } = await supabase.storage
        .from('listing-images')
        .remove(fileNames);

      if (storageError) {
        console.error("Warning: DB deleted, but failed to clean up Supabase files:", storageError);
      }
    }

    res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("Error deleting listing:", error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router