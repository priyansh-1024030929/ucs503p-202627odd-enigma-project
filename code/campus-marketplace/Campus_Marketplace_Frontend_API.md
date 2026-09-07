# Campus Marketplace — Frontend API Guide

This document describes how the React frontend should communicate with the Campus Marketplace backend.

The backend owns authentication, authorization, database access, business rules, and Supabase Storage access. The frontend should **not** connect directly to PostgreSQL or use the Supabase secret key.

---

## 1. Backend URL

During local development:

```text
http://localhost:5000
```

All API requests use this as the base URL.

Example:

```text
GET http://localhost:5000/api/listings
```

---

# 2. Authentication

Authentication is handled by **Auth0**.

After the user logs in through Auth0, the frontend receives an Auth0 **access token**.

For every protected API request, send:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Example:

```http
Authorization: Bearer eyJhbGciOi...
```

Do not send the Auth0 `id_token` as the API bearer token. The backend expects the access token whose audience is:

```text
https://api.campus-marketplace
```

### Important

The frontend does **not** send `user_id` to identify the currently logged-in user when the backend can determine it from the token.

The backend gets the authenticated user's Auth0 identity and maps it to the local PostgreSQL `users.user_id`.

This is important for security.

For example, do **not** do this:

```json
{
  "owner_id": 13,
  "title": "Calculator"
}
```

to tell the backend who owns the listing.

The backend determines the owner from the authenticated user.

---

# 3. Current User

## Get current user

```http
GET /api/users/me
```

### Headers

```http
Authorization: Bearer <ACCESS_TOKEN>
```

### Response

```json
{
  "user": {
    "user_id": "13",
    "auth_user_id": "google-oauth2|...",
    "name": "Aditya Sharma",
    "email": "aaditya_be24@thapar.edu",
    "contact_info": "8930450223",
    "created_at": "2026-08-24T04:29:36.491Z"
  }
}
```

Use this endpoint when the frontend needs the application's local user object.

---

## Update current user

```http
PATCH /api/users/me
```

### Body

```json
{
  "name": "Aditya Sharma",
  "contact_info": "8930450223"
}
```

Both fields are optional, but at least one field must be provided.

Invalid:

```json
{}
```

Expected error:

```json
{
  "error": "At least one field must be provided"
}
```

---

# 4. Listing Object

A listing generally looks like:

```json
{
  "listing_id": "28",
  "owner_id": "13",
  "owner_name": "Aditya Sharma",
  "category_id": "1",
  "category_name": "Books",
  "title": "TI-84 Calculator",
  "description": "Available for short-term borrowing",
  "type": "BORROW",
  "price": null,
  "price_per_day": "50.00",
  "status": "ACTIVE",
  "created_at": "2026-08-24T04:52:15.163Z",
  "updated_at": "2026-08-24T04:52:15.163Z",
  "images": [
    "https://...."
  ]
}
```

### Listing types

```text
SELL
BORROW
```

For a `SELL` listing:

```text
price          -> populated
price_per_day  -> null
```

For a `BORROW` listing:

```text
price          -> null
price_per_day  -> populated
```

---

# 5. Browse Listings

```http
GET /api/listings
```

Returns active listings.

Example response:

```json
{
  "listings": [
    {
      "listing_id": "27",
      "owner_id": "13",
      "owner_name": "Aditya Sharma",
      "category_id": "1",
      "category_name": "Books",
      "title": "TI-84 Calculator",
      "description": "Available for short-term borrowing",
      "type": "BORROW",
      "price": null,
      "price_per_day": "50.00",
      "status": "ACTIVE",
      "created_at": "...",
      "updated_at": "...",
      "images": []
    }
  ]
}
```

---

# 6. Search / Filter Listings

Use query parameters.

Example:

```http
GET /api/listings?query=drill&type=BORROW&min_price=0&max_price=100
```

Supported filters currently include:

```text
query
category_id
type
min_price
max_price
```

Example:

```http
GET /api/listings?category_id=1
```

```http
GET /api/listings?type=SELL
```

```http
GET /api/listings?query=calculator
```

The frontend should build these query parameters dynamically from its search/filter UI.

---

# 7. View Listing Details

```http
GET /api/listings/:listingId
```

Example:

```http
GET /api/listings/28
```

Response:

```json
{
  "listing": {
    "listing_id": "28",
    "owner_id": "13",
    "title": "POSTMAN TEST LISTING",
    "type": "BORROW",
    "price": null,
    "price_per_day": "10.00",
    "status": "ACTIVE",
    "images": [
      "https://...."
    ]
  }
}
```

The `images` array contains URLs that can be used directly in `<img src="...">`.

---

# 8. Create Listing

```http
POST /api/listings
```

### Headers

```http
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### Body — BORROW

```json
{
  "category_id": 1,
  "title": "TI-84 Calculator",
  "description": "Available for short-term borrowing",
  "type": "BORROW",
  "price_per_day": 50
}
```

### Body — SELL

```json
{
  "category_id": 1,
  "title": "Scientific Calculator",
  "description": "Casio calculator in good condition",
  "type": "SELL",
  "price": 800
}
```

### Do NOT send

```json
{
  "owner_id": 13
}
```

The backend determines the owner from the Auth0 token.

The listing is initially:

```text
status = ACTIVE
```

---

# 9. Listing Images — IMPORTANT

Images are handled **separately from listing creation**.

Creating a listing does not upload its images.

The frontend should:

1. Create the listing.
2. Get the returned `listing_id`.
3. Upload each image separately.
4. Use the returned image information if needed.
5. Fetch/display the listing normally.

### Upload image

```http
POST /api/listings/:listingId/images
```

Example:

```http
POST /api/listings/28/images
```

### Headers

```http
Authorization: Bearer <ACCESS_TOKEN>
```

### Body

Use:

```text
multipart/form-data
```

with:

```text
image = <File>
```

Do **not** send JSON.

Do **not** manually set `Content-Type`; let the browser/HTTP client generate the multipart boundary.

Accepted image types:

```text
image/jpeg
image/png
image/webp
```

Maximum size:

```text
5 MB
```

The backend generates the Storage filename and uploads the file to the Supabase `listing-images` bucket.

The frontend does not need the Supabase secret key.

---

## 9.1 Image response

Example:

```json
{
  "image": {
    "image_id": "12",
    "listing_id": "28",
    "image_url": "https://esdwtoeijsahokfxfgxa.supabase.co/storage/v1/object/public/listing-images/listing-28/81eba4ca-1c74-40c6-bd17-615bff2171a3.jpg",
    "created_at": "2026-08-29T16:23:19.615Z"
  }
}
```

The `image_url` can be used directly by the frontend.

---

## 9.2 Delete an image — IMPORTANT

**Deleting a listing does not mean the frontend should ignore its images.**

Images are separate resources.

To remove an image:

```http
DELETE /api/listings/:listingId/images/:imageId
```

Example:

```http
DELETE /api/listings/28/images/12
```

The backend removes:

1. The `listing_images` database record.
2. The corresponding object from Supabase Storage.

### Frontend rule

If the user removes an image from an existing listing:

```text
DELETE /api/listings/28/images/12
```

Do not simply remove the image from React state and assume the backend/storage is updated.

---

# 10. Removing / Deactivating a Listing

There is intentionally **no edit-listing API** in the current design.

If an owner wants to stop a listing:

```http
DELETE /api/listings/:listingId
```

or use the current listing-deactivation endpoint exposed by the backend.

The owner must be authenticated and must own the listing.

### Important image rule

Listing images are separate records/objects.

When implementing listing deletion/deactivation in the UI, treat image cleanup as a separate concern. If the backend endpoint only changes the listing status, the frontend should not assume the Storage objects disappeared.

For image cleanup, explicitly call:

```http
DELETE /api/listings/:listingId/images/:imageId
```

for each image that needs to be removed.

---

# 11. View Own Listings

Use the authenticated user.

The frontend should not need to supply the current user's ID to prove ownership.

The backend should return the authenticated user's listings through the listing "mine/own listings" endpoint.

Use the endpoint exposed by the current backend for:

```text
GET own listings
```

The returned objects use the same listing shape described above.

---

# 12. Borrowing

A borrowing request represents a request to reserve a `BORROW` listing for a time period.

## Create borrowing request

```http
POST /api/borrowings
```

### Body

```json
{
  "listing_id": 28,
  "start_time": "2027-10-01T09:00:00Z",
  "end_time": "2027-10-02T09:00:00Z"
}
```

Do not send `borrower_id`.

The backend determines the borrower from the Auth0 token.

The request starts as:

```text
PENDING
```

The total amount is calculated from the listing's `price_per_day`.

Example:

```json
{
  "borrowing": {
    "borrowing_id": "12",
    "listing_id": "28",
    "total_amount": "10.00",
    "status": "PENDING"
  }
}
```

---

## Borrowing lifecycle

```text
PENDING
   |
   +----> REJECTED
   |
   +----> BOOKED
             |
             +----> ACTIVE
                       |
                       +----> RETURNED
```

A borrowing can also be cancelled where supported.

---

## View own borrowings

Use the authenticated user's borrowing endpoint.

Conceptually:

```text
GET /api/borrowings/mine
```

Returns borrowings where the current user is the borrower.

---

## View incoming borrow requests

Listing owners need to see requests for their own listings.

Conceptually:

```text
GET /api/borrowings/incoming
```

The backend determines the owner from the authenticated user.

---

## Accept / reject borrowing

```http
PATCH /api/borrowings/:borrowingId/decision
```

### Accept

```json
{
  "decision": "ACCEPT"
}
```

### Reject

```json
{
  "decision": "REJECT"
}
```

Accepting changes the request to:

```text
BOOKED
```

Rejecting changes it to:

```text
REJECTED
```

The database also prevents overlapping booked periods for the same listing.

---

## Return / cancel borrowing

Use the borrowing status endpoint exposed by the backend.

The supported terminal states include:

```text
RETURNED
CANCELLED
```

Example request body:

```json
{
  "status": "RETURNED"
}
```

---

# 13. Purchase Requests

Purchase requests are only for `SELL` listings.

## Express interest

```http
POST /api/purchase-requests
```

### Body

```json
{
  "listing_id": 26
}
```

Do not send `buyer_id`.

The backend gets the buyer from the Auth0 token.

New requests start as:

```text
PENDING
```

---

## View own purchase requests

Use the authenticated user's purchase-request endpoint.

Conceptually:

```text
GET /api/purchase-requests/mine
```

---

## View incoming purchase requests

For sellers:

```text
GET /api/purchase-requests/incoming
```

The backend determines which requests belong to the authenticated seller.

---

## Accept / reject purchase request

```http
PATCH /api/purchase-requests/:requestId/decision
```

### Accept

```json
{
  "decision": "ACCEPT"
}
```

### Reject

```json
{
  "decision": "REJECT"
}
```

When a purchase request is accepted, the backend creates the corresponding transaction and marks the listing:

```text
SOLD
```

This operation is kept atomic by the backend.

The frontend should not attempt to create the transaction itself.

---

# 14. Transactions

Transactions are created by the backend as part of accepting a purchase request.

The frontend should **not** create a transaction directly.

## Complete transaction

```http
PATCH /api/transactions/:transactionId/complete
```

No amount or buyer/seller information should be supplied by the frontend.

The backend changes:

```text
PENDING
```

to:

```text
COMPLETED
```

and records:

```text
completed_at
```

---

## Transaction history

Use the authenticated user's transaction-history endpoint.

Conceptually:

```text
GET /api/transactions/mine
```

This should return transactions where the current user is either:

```text
buyer
```

or:

```text
seller
```

---

# 15. Reviews

A review can be associated with either:

```text
Transaction
```

or:

```text
Borrowing
```

The reviewer should **not** send their own user ID.

The backend determines the reviewer from Auth0.

## Review a transaction

```http
POST /api/reviews
```

```json
{
  "deal_type": "T",
  "transaction_id": 1,
  "rating": 5,
  "comment": "Smooth handoff."
}
```

## Review a borrowing

```json
{
  "deal_type": "B",
  "borrowing_id": 5,
  "rating": 5,
  "comment": "Good experience."
}
```

Rating:

```text
1 - 5
```

A review is only valid after the associated deal has reached its appropriate completed state.

Users cannot review deals they were not part of, and the same deal cannot be reviewed repeatedly by the same reviewer.

---

# 16. User Profile Reviews

When displaying another user's profile, the frontend can request that user's profile/reviews endpoint.

The returned user information should be treated as public profile information.

Do not expose private authentication information from the Auth0 token in the UI.

---

# 17. Error Handling

The backend returns JSON errors.

Typical shape:

```json
{
  "error": "Unauthorized"
}
```

or:

```json
{
  "error": "Only @thapar.edu accounts are allowed"
}
```

or:

```json
{
  "error": "At least one field must be provided"
}
```

The frontend should handle HTTP status codes normally:

```text
400 → invalid request
401 → missing/invalid authentication
403 → authenticated but not allowed
404 → resource not found
409 → conflicting operation
500 → server error
```

Do not assume every error response has the exact same message.

Use the HTTP status for control flow and the `error` field for displaying/logging the explanation.

---

# 18. IDs

IDs returned by PostgreSQL may arrive as strings in JSON:

```json
{
  "listing_id": "28"
}
```

Even though the underlying PostgreSQL value is numeric.

The frontend should therefore avoid assuming every ID is a JavaScript number.

Treat IDs as opaque identifiers.

---

# 19. Important Frontend Rules

### Rule 1 — Always authenticate protected requests

```http
Authorization: Bearer <ACCESS_TOKEN>
```

### Rule 2 — Never send the Supabase secret key to the browser

The frontend should never contain:

```text
SUPABASE_SECRET_KEY
```

### Rule 3 — Don't trust client-supplied ownership

Don't send:

```text
owner_id
borrower_id
buyer_id
reviewer_id
```

when the backend can derive them from the authenticated user.

### Rule 4 — Don't create transactions from the frontend

Accepting a purchase request causes the backend to create the transaction.

### Rule 5 — Images are separate

Creating a listing:

```text
POST /api/listings
```

does not upload images.

Upload them afterward:

```text
POST /api/listings/:listingId/images
```

### Rule 6 — Deleting an image is a separate operation

If an image is removed:

```text
DELETE /api/listings/:listingId/images/:imageId
```

The frontend must not assume deleting/updating the listing automatically removes the Storage object.

### Rule 7 — Listing editing is intentionally limited

There is currently no normal edit-listing interaction.

The intended approach is to deactivate/remove the existing listing and create a new one if the listing details need to change.

---

# 20. Recommended Frontend Listing Flow

For creating a listing with images:

```text
1. User fills listing form
          ↓
2. POST /api/listings
          ↓
3. Receive listing_id
          ↓
4. For every selected image:
       POST /api/listings/:listingId/images
          ↓
5. Refresh listing / use returned image URLs
```

For editing the image set of an existing listing:

```text
Existing images
      |
      +---- image removed
      |          ↓
      |   DELETE /api/listings/:id/images/:imageId
      |
      +---- new image added
                 ↓
          POST /api/listings/:id/images
```

For displaying a listing:

```text
GET /api/listings/:id
        ↓
listing.images
        ↓
<img src={imageUrl} />
```

No Supabase SDK is required in the frontend for listing images.

---

# 21. Recommended Axios/Fetch Pattern

The frontend should have one central API client that automatically attaches the Auth0 access token.

Conceptually:

```js
const response = await fetch(
  `${API_BASE_URL}/api/listings`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);
```

For JSON:

```js
const response = await fetch(
  `${API_BASE_URL}/api/listings`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }
);
```

For images:

```js
const formData = new FormData();
formData.append("image", file);

await fetch(
  `${API_BASE_URL}/api/listings/${listingId}/images`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  }
);
```

**Do not set `Content-Type: multipart/form-data` manually.**

The browser must add the multipart boundary.

---

# 22. Entity Shapes

The main entities used by the application are:

```text
user
listing
borrowing
purchase_request
transaction
review
```

### user

```json
{
  "user_id": 3,
  "name": "Kabir Singh"
}
```

### listing

```json
{
  "listing_id": 2,
  "title": "Electric Drill",
  "description": "Cordless drill with charger and bit set.",
  "type": "BORROW",
  "price": null,
  "price_per_day": "60.00",
  "status": "ACTIVE",
  "category": "Electronics",
  "owner": {
    "user_id": 3,
    "name": "Kabir Singh"
  },
  "images": [
    "https://..."
  ],
  "created_at": "2026-08-01T10:00:00Z"
}
```

### borrowing

```json
{
  "borrowing_id": 9,
  "listing_id": 2,
  "borrower": {
    "user_id": 5,
    "name": "..."
  },
  "start_time": "2027-10-01T09:00:00Z",
  "end_time": "2027-10-02T09:00:00Z",
  "total_amount": "60.00",
  "status": "PENDING",
  "created_at": "2027-09-20T10:00:00Z",
  "responded_at": null
}
```

### purchase_request

```json
{
  "request_id": 6,
  "listing_id": 7,
  "buyer": {
    "user_id": 5,
    "name": "..."
  },
  "status": "PENDING",
  "created_at": "2027-09-20T10:00:00Z",
  "responded_at": null
}
```

### transaction

```json
{
  "transaction_id": 3,
  "listing_id": 5,
  "buyer": {
    "user_id": 5,
    "name": "..."
  },
  "seller": {
    "user_id": 3,
    "name": "..."
  },
  "amount": "600.00",
  "status": "PENDING",
  "created_at": "2027-09-20T10:00:00Z",
  "completed_at": null
}
```

### review

```json
{
  "review_id": 1,
  "transaction_id": 1,
  "borrowing_id": null,
  "reviewer": {
    "user_id": 2,
    "name": "..."
  },
  "reviewee": {
    "user_id": 1,
    "name": "..."
  },
  "rating": 5,
  "comment": "Smooth handoff.",
  "created_at": "2027-09-25T12:00:00Z"
}
```

---

# 23. Overall Application Flow

```text
AUTH0 LOGIN
    ↓
GET CURRENT USER
    ↓
BROWSE / SEARCH LISTINGS
    ↓
┌───────────────────────────┐
│                           │
│ SELL                      │ BORROW
│ ↓                         │ ↓
│ Purchase Request          │ Borrow Request
│ ↓                         │ ↓
│ Seller Accepts            │ Owner Accepts
│ ↓                         │ ↓
│ Transaction               │ Booking
│ ↓                         │ ↓
│ Complete                  │ Return
│                           │
└──────────────┬────────────┘
               ↓
             REVIEW
```

---

# 24. What the Frontend Does NOT Need to Know

The frontend does not need to directly interact with:

```text
PostgreSQL
Supabase Storage SDK
Supabase secret key
Auth0 Management API
database user IDs for authenticated actions
```

The frontend only needs:

```text
Auth0 access token
        +
REST API
        +
returned JSON
```

For images specifically:

```text
Frontend
   ↓
POST multipart image
   ↓
Express backend
   ↓
Supabase Storage
   ↓
image_url
   ↓
listing response
```

That is the intended integration boundary.
