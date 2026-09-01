# SwiftPay API Reference Card v2.0.0

## Quick API Reference

### Authentication
All endpoints (except `/register`, `/login`, `/otp`) require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Transaction Endpoints

### Transfer Money (Atomic)
```
POST /api/v1/transactions/transfer
Content-Type: application/json
Authorization: Bearer <token>

{
  "toUserId": "recipient_user_id",
  "amount": 100,
  "note": "Payment for coffee"
}

Response 200:
{
  "success": true,
  "transaction": {
    "_id": "transaction_id",
    "sender": "your_id",
    "receiver": "recipient_id",
    "amount": 100,
    "type": "transfer",
    "status": "success",
    "description": "Payment for coffee",
    "createdAt": "2024-01-16T10:30:00Z"
  }
}

Rate Limit: 10 requests/minute
```

### Get Transaction History
```
GET /api/v1/transactions?page=1&limit=20
Authorization: Bearer <token>

Response 200:
{
  "data": [
    {
      "_id": "txn_id",
      "sender": {...},
      "receiver": {...},
      "amount": 100,
      "type": "transfer",
      "status": "success",
      "createdAt": "2024-01-16T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

### Get Transaction Statistics
```
GET /api/v1/transactions/stats
Authorization: Bearer <token>

Response 200:
{
  "totalSent": 5000,
  "totalReceived": 3500,
  "transactionCount": 25,
  "averageAmount": 340
}
```

### Get Monthly Breakdown
```
GET /api/v1/transactions/monthly
Authorization: Bearer <token>

Response 200:
{
  "monthly": [
    {
      "month": "December",
      "year": 2023,
      "sent": 1000,
      "received": 800
    },
    {
      "month": "January",
      "year": 2024,
      "sent": 2000,
      "received": 1500
    }
  ]
}
```

### Get Transaction Details
```
GET /api/v1/transactions/:transactionId
Authorization: Bearer <token>

Response 200:
{
  "_id": "txn_id",
  "sender": "user_id",
  "receiver": "recipient_id",
  "amount": 100,
  "description": "Coffee",
  "type": "transfer",
  "status": "success",
  "createdAt": "2024-01-16T10:30:00Z",
  "metadata": {
    "notes": "Payment for lunch",
    "reference": "INV-001"
  }
}
```

---

## Payment Request Endpoints

### Create Payment Request
```
POST /api/v1/requests
Content-Type: application/json
Authorization: Bearer <token>

{
  "targetId": "recipient_user_id",
  "amount": 500,
  "note": "Dinner payment"
}

Response 201:
{
  "_id": "request_id",
  "requester": "your_id",
  "target": "target_id",
  "amount": 500,
  "note": "Dinner payment",
  "status": "pending",
  "createdAt": "2024-01-16T10:30:00Z"
}

Rate Limit: 50 requests/15 minutes
```

### Get Payment Requests
```
GET /api/v1/requests?type=incoming&status=pending
Authorization: Bearer <token>

Query Parameters:
  - type: "incoming" | "outgoing" | "all"
  - status: "pending" | "accepted" | "rejected" | "cancelled"

Response 200:
{
  "requests": [
    {
      "_id": "req_id",
      "requester": {...},
      "target": {...},
      "amount": 500,
      "status": "pending",
      "note": "Dinner payment",
      "createdAt": "2024-01-16T10:30:00Z"
    }
  ]
}
```

### Get Request Details
```
GET /api/v1/requests/:requestId
Authorization: Bearer <token>

Response 200:
{
  "_id": "req_id",
  "requester": "requester_id",
  "target": "target_id",
  "amount": 500,
  "note": "Dinner",
  "status": "pending",
  "respondedAt": null,
  "createdAt": "2024-01-16T10:30:00Z"
}
```

### Accept Payment Request
```
POST /api/v1/requests/:requestId/accept
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "request": {
    "_id": "req_id",
    "status": "accepted",
    "respondedAt": "2024-01-16T10:35:00Z",
    "transactionId": "txn_id"
  },
  "transaction": {
    "_id": "txn_id",
    "amount": 500,
    "type": "request_accept",
    "status": "success"
  }
}

Note: Automatically transfers money from requester to you
```

### Reject Payment Request
```
POST /api/v1/requests/:requestId/reject
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "request": {
    "_id": "req_id",
    "status": "rejected",
    "respondedAt": "2024-01-16T10:35:00Z"
  }
}

Note: No money transfer occurs
```

---

## Socket.IO Events

### Connect
```javascript
const socket = io('http://localhost:8080', {
  auth: {
    token: localStorage.getItem('token')
  }
})

socket.on('connect', () => {
  console.log('Connected to server');
})

socket.on('disconnect', () => {
  console.log('Disconnected');
})
```

### Listen for Events

**Payment Received**
```javascript
socket.on('payment_received', (data) => {
  // {
  //   transactionId: "...",
  //   amount: 100,
  //   senderId: "...",
  //   senderName: "John Doe",
  //   type: "transfer",
  //   createdAt: "2024-01-16T10:30:00Z"
  // }
  console.log(`Received ₹${data.amount} from ${data.senderName}`);
})
```

**Payment Request Received**
```javascript
socket.on('payment_request', (data) => {
  // {
  //   requestId: "...",
  //   requesterId: "...",
  //   requesterName: "Jane Doe",
  //   amount: 50,
  //   note: "Lunch money",
  //   createdAt: "2024-01-16T10:30:00Z"
  // }
  console.log(`${data.requesterName} requested ₹${data.amount}`);
})
```

**Request Accepted**
```javascript
socket.on('payment_request_accepted', (data) => {
  // {
  //   requestId: "...",
  //   amount: 50,
  //   acceptedBy: "...",
  //   transactionId: "...",
  //   timestamp: "2024-01-16T10:35:00Z"
  // }
  console.log(`Your request of ₹${data.amount} was accepted`);
})
```

**Request Rejected**
```javascript
socket.on('payment_request_rejected', (data) => {
  // {
  //   requestId: "...",
  //   amount: 50,
  //   rejectedBy: "...",
  //   timestamp: "2024-01-16T10:35:00Z"
  // }
  console.log(`Your request of ₹${data.amount} was rejected`);
})
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request body",
  "details": ["amount must be greater than 0"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Transaction not found"
}
```

### 409 Conflict
```json
{
  "error": "Insufficient funds",
  "message": "Your balance is too low for this transfer"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limits

| Endpoint | Type | Limit |
|----------|------|-------|
| `/transfer` | Transfer | 10/min |
| `/requests` | Payment Request | 50/15min |
| `POST /requests/:id/accept` | Request Accept | 50/15min |
| `/login` | Auth | 20/15min |
| `/register` | Auth | 20/15min |
| `/otp/send` | OTP | 5/min |
| General | API | 100/15min |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Invalid state (e.g., insufficient funds) |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error - Internal error |

---

## Example: Complete Transfer Flow

```bash
# 1. Transfer money
curl -X POST http://localhost:8080/api/v1/transactions/transfer \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user_id",
    "amount": 100,
    "note": "Payment"
  }'

# Response: Transaction created with status "success"

# 2. Get transactions
curl http://localhost:8080/api/v1/transactions \
  -H "Authorization: Bearer <TOKEN>"

# 3. Monitor via Socket.IO
# Receiver gets 'payment_received' event
# Both parties can see transaction in history
```

---

## Example: Complete Payment Request Flow

```bash
# 1. Create request
curl -X POST http://localhost:8080/api/v1/requests \
  -H "Authorization: Bearer <TOKEN1>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetId": "user2_id",
    "amount": 500,
    "note": "Dinner"
  }'

# Requester (user1) created request
# Target (user2) gets 'payment_request' event

# 2. Accept request (as user2)
curl -X POST http://localhost:8080/api/v1/requests/<request_id>/accept \
  -H "Authorization: Bearer <TOKEN2>"

# Response: 
#   - Request status changed to "accepted"
#   - Transfer created with ₹500 from user1 to user2
#   - Both parties get Socket events

# 3. Target sees transaction in history
curl http://localhost:8080/api/v1/transactions \
  -H "Authorization: Bearer <TOKEN2>"
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid token` | Token expired or malformed | Re-login |
| `Insufficient funds` | Balance too low | Add funds first |
| `User not found` | Invalid recipient ID | Verify user exists |
| `Rate limit exceeded` | Too many requests | Wait and retry |
| `Cannot transfer to self` | Sending to own account | Select different recipient |
| `Request not found` | Invalid request ID | Verify request exists |
| `Cannot accept own request` | Accepting own request | Request must be to you |

---

## Testing Endpoints with cURL

```bash
# Set variables
TOKEN="your_jwt_token"
USER_ID="recipient_user_id"
AMOUNT=100

# Transfer
curl -X POST http://localhost:8080/api/v1/transactions/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"toUserId\":\"$USER_ID\",\"amount\":$AMOUNT}"

# Get stats
curl http://localhost:8080/api/v1/transactions/stats \
  -H "Authorization: Bearer $TOKEN"

# Get requests
curl http://localhost:8080/api/v1/requests \
  -H "Authorization: Bearer $TOKEN"

# Health check
curl http://localhost:8080/health
```

---

**SwiftPay v2.0.0 API Reference**  
Generated: 2024-01-16  
Status: Production Ready
