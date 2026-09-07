// =====================================================================
// SERVER ENTRY POINT
// =====================================================================
import express from 'express'
import cors from 'cors'
import requestsRouter from './routes/requests.js'
import listingsRouter from './routes/listings.js'
import usersRouter from './routes/users.js'
import transactionsRouter from './routes/transactions.js'
import purchaseRequestsRouter from './routes/purchaseRequests.js'
import borrowingsRouter from './routes/borrowings.js'


const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/listings', listingsRouter)
app.use('/api/users', usersRouter)
app.use('/api/transactions', transactionsRouter)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/requests', requestsRouter)
app.use('/api/purchase-requests', purchaseRequestsRouter)
app.use('/api/borrowings', borrowingsRouter)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Campus Marketplace API running on port ${PORT}`))
