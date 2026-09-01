# SwiftPay - Architecture & Low Level Design (LLD)

## Table of Contents
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Data Models](#data-models)
- [API Architecture](#api-architecture)
- [Module Details](#module-details)
- [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (React Frontend - Vite, Redux, Tailwind CSS)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS/REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    API Gateway Layer                         │
│              (Express.js Server - Port 8080)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Middleware Layer                             │   │
│  │  - CORS Handling                                      │   │
│  │  - Authentication (JWT)                              │   │
│  │  - Request Logging                                   │   │
│  │  - Rate Limiting                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Route Layer                                  │   │
│  │  - /api/v1/user (User Management)                   │   │
│  │  - /api/v1/account (Account Management)             │   │
│  │  - /api/v1/otp (OTP Verification)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌─────▼────┐  ┌───▼──────────┐
│ MongoDB  │  │  NodeMailer  │  │  External   │
│ Database │  │  (Email)     │  │  Services   │
└──────────┘  └──────────┘  └────────────┘
```

---

## Project Structure

```
SwiftPay/
├── frontend/                          # React Frontend Application
│   ├── src/
│   │   ├── components/               # Reusable React components
│   │   │   ├── Dashboard.jsx         # User dashboard
│   │   │   ├── Signin.jsx            # Login page
│   │   │   ├── Signup.jsx            # Registration page
│   │   │   ├── OtpValidation.jsx     # OTP verification
│   │   │   ├── Edit.jsx              # User edit profile
│   │   │   ├── ContactUs.jsx         # Contact form
│   │   │   ├── LandingPage.jsx       # Landing page
│   │   │   └── templates/            # Layout components
│   │   │       ├── Topnav.jsx        # Navigation bar
│   │   │       ├── SenderMoney.jsx   # Money transfer
│   │   │       ├── UserDetails.jsx   # User information
│   │   │       └── DeleteAccount.jsx # Account deletion
│   │   ├── store/                    # Redux store
│   │   │   ├── store.jsx             # Redux configuration
│   │   │   └── reducers/
│   │   │       └── userSlice.jsx     # User state management
│   │   ├── utils/
│   │   │   └── axios.jsx             # API client configuration
│   │   ├── App.jsx                   # Main app component
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── public/                        # Static assets
│   ├── Dockerfile                     # Frontend container config
│   ├── .dockerignore                  # Docker ignore rules
│   ├── vite.config.js                # Vite configuration
│   ├── tailwind.config.js             # Tailwind CSS config
│   └── package.json                   # Dependencies
│
├── backend/                           # Express.js Backend Server
│   ├── db/
│   │   └── db.js                     # MongoDB connection & schemas
│   │       ├── UserSchema            # User model with password hashing
│   │       ├── AccountSchema         # Account/balance model
│   │       └── OTPSchema             # OTP with TTL
│   ├── routes/
│   │   ├── index.js                  # Router setup
│   │   ├── user.js                   # User endpoints
│   │   ├── account.js                # Account endpoints
│   │   └── otp.js                    # OTP endpoints
│   ├── middlewares/
│   │   └── middleware.js             # Auth & utility middleware
│   ├── utils/
│   │   └── mailSender.js             # Email sending utility
│   ├── validations/
│   │   └── schemas.js                # Zod validation schemas
│   ├── Dockerfile                     # Backend container config
│   ├── .dockerignore                  # Docker ignore rules
│   ├── config.js                      # Configuration from env
│   ├── index.js                       # Express server entry point
│   └── package.json                   # Dependencies
│
├── docker-compose.yml                 # Multi-container orchestration
├── .env.example                        # Environment template
├── ARCHITECTURE.md                     # This file
├── DOCKER.md                           # Docker instructions
└── README.md                           # Project overview
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Zod (Schema validation)
- **Email**: Nodemailer
- **Security**: bcrypt (Password hashing)
- **OTP Generation**: otp-generator

### Frontend
- **Framework**: React 18.2
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **HTTP Client**: Axios
- **Animations**: Framer Motion
- **UI Icons**: Lucide React, Remixicon
- **Form Validation**: Zod

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Container Registry**: (Optional) Docker Hub/Private Registry

---

## Data Models

### 1. User Schema
```javascript
{
  firstName: String (required, min: 2),
  lastName: String (required, min: 2),
  username: String (required, unique, 3-30 chars),
  email: String (required, unique),
  password: String (required, hashed with bcrypt),
  createdAt: Date (default: now),
  updatedAt: Date
}
```

### 2. Account Schema
```javascript
{
  userId: ObjectId (ref: User, required),
  balance: Number (required, default: 0, min: 0),
  createdAt: Date (default: now),
  updatedAt: Date
}
```

### 3. OTP Schema
```javascript
{
  email: String (required),
  otp: String (required, 6 digits),
  createdAt: Date (TTL: 2 minutes auto-delete),
  expiresAt: Date
}
```

### 4. Transaction Schema ⭐ NEW
```javascript
{
  // Transaction identification
  _id: ObjectId (unique identifier),
  
  // Parties involved
  sender: ObjectId (ref: User, required),
  receiver: ObjectId (ref: User, required),
  
  // Amount
  amount: Number (required, min: 1),
  
  // Transaction details
  type: String (enum: ['transfer', 'refund', 'request_payment', 'request_accept']),
  status: String (enum: ['pending', 'success', 'failed'], default: 'pending'),
  description: String (optional),
  
  // Metadata
  metadata: {
    paymentRequestId: ObjectId (optional, if from request),
    refundReason: String (optional),
    notes: String (optional)
  },
  
  // Timestamps
  createdAt: Date (immutable, default: now),
  updatedAt: Date,
  
  // Indexes
  indexes: [
    { sender: 1, createdAt: -1 },
    { receiver: 1, createdAt: -1 },
    { createdAt: -1 }
  ]
}
```

**Key Features**:
- **Immutable Ledger**: `createdAt` cannot be changed after creation
- **Atomic Operations**: Created within MongoDB sessions during transfers
- **Complete Audit Trail**: All transactions recorded with timestamp
- **Efficient Queries**: Indexed by sender/receiver for quick lookups

### 5. Payment Request Schema ⭐ NEW
```javascript
{
  // Request identification
  _id: ObjectId (unique identifier),
  
  // Parties involved
  requester: ObjectId (ref: User, required),
  target: ObjectId (ref: User, required),
  
  // Request details
  amount: Number (required, min: 1),
  note: String (optional),
  
  // Status tracking
  status: String (enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending'),
  respondedAt: Date (optional, set only when accepted/rejected),
  
  // Related transaction
  transactionId: ObjectId (ref: Transaction, optional),
  
  // Timestamps
  createdAt: Date (default: now),
  updatedAt: Date
}
```

**Workflow**:
1. **Created**: `status: 'pending'`, `respondedAt: null`
2. **Accepted**: `status: 'accepted'`, `respondedAt: now`, `transactionId: <id>`
   - Automatic atomic transfer created
   - Transaction ledger entry created
   - Both parties notified via Socket.IO
3. **Rejected**: `status: 'rejected'`, `respondedAt: now`, `transactionId: null`
   - No transfer occurs
   - Requester notified

---

## API Architecture

### Authentication Flow
```
1. User Registration
   POST /api/v1/user/register
   └─> Request body validations with Zod
   └─> Create user with hashed password (bcrypt 10 rounds)
   └─> Create associated account with initial balance
   └─> Generate JWT token (15-minute expiry)
   └─> Send verification OTP to email
   └─> Return JWT token + refresh token

2. User Login
   POST /api/v1/user/login
   └─> Validate credentials (rate limited: 20 requests/15 min)
   └─> Generate JWT token (15-minute expiry)
   └─> Return user data + token + refresh token

3. OTP Verification
   POST /api/v1/otp/send
   └─> Generate 6-digit OTP
   └─> Send via Nodemailer (Gmail)
   └─> Store in database with 2-min TTL
   └─> Rate limited: 5 requests/min
   
   POST /api/v1/otp/verify
   └─> Validate OTP against stored value
   └─> Check expiry
   └─> Mark email as verified
   └─> Return success/failure
```

### Account Operations Flow
```
1. Get Account Balance
   GET /api/v1/account/balance
   └─> Authenticate via JWT
   └─> Fetch user's account
   └─> Return balance

2. Send Money → REPLACED WITH /transactions/transfer
   (See Payment Operations below)

3. Get Account Details
   GET /api/v1/account/details
   └─> Authenticate via JWT
   └─> Return account information
```

### Payment Operations Flow ⭐ NEW

```
1. ATOMIC TRANSFER (with Transaction Ledger)
   POST /api/v1/transactions/transfer
   ├─> Authentication (JWT required)
   ├─> Input validation (Zod schema)
   ├─> Rate limiting (10 requests/min)
   └─> Service Layer:
       ├─> Start MongoDB Session
       ├─> Lock both sender & receiver accounts
       ├─> Validate sender has sufficient balance
       ├─> Validate sender ≠ receiver
       ├─> Deduct from sender balance
       ├─> Add to receiver balance
       ├─> Create Transaction ledger entry (status: pending)
       ├─> Update transaction status to success
       ├─> Commit transaction
       └─> Emit Socket.IO: payment_received → receiver
       
   Response:
   {
     success: true,
     transaction: {
       _id: "...",
       sender: "userId",
       receiver: "receiverId",
       amount: 100,
       type: "transfer",
       status: "success",
       createdAt: "2024-01-16T..."
     }
   }

2. TRANSACTION HISTORY
   GET /api/v1/transactions?page=1&limit=20
   ├─> Authenticate via JWT
   ├─> Aggregate user transactions (sender + receiver)
   ├─> Apply pagination
   ├─> Sort by createdAt (newest first)
   └─> Return paginated transaction list

3. TRANSACTION STATISTICS
   GET /api/v1/transactions/stats
   ├─> Authenticate via JWT
   ├─> MongoDB Aggregation Pipeline:
   │   ├─> Match: sender OR receiver = current user
   │   ├─> Calculate: totalSent, totalReceived, count
   │   └─> Facet for parallel calculations
   └─> Return stats object

4. MONTHLY BREAKDOWN
   GET /api/v1/transactions/monthly
   ├─> Authenticate via JWT
   ├─> Aggregate last 6 months
   ├─> Group by year/month
   ├─> Separate sent/received
   └─> Return monthly data for charts

5. TRANSACTION DETAILS
   GET /api/v1/transactions/:id
   ├─> Authenticate via JWT
   ├─> Verify user is sender or receiver (access control)
   └─> Return full transaction details
```

### Payment Requests Flow ⭐ NEW

```
1. CREATE PAYMENT REQUEST
   POST /api/v1/requests
   ├─> Authentication (JWT required)
   ├─> Input validation (Zod schema)
   ├─> Rate limiting (50 requests/15 min)
   └─> Service Layer:
       ├─> Validate target user exists
       ├─> Validate requester ≠ target
       ├─> Create PaymentRequest (status: pending)
       └─> Emit Socket.IO: payment_request → target user
       
   Response: { _id, requester, target, amount, status, createdAt }

2. LIST PAYMENT REQUESTS
   GET /api/v1/requests?type=incoming&status=pending
   ├─> Authentication (JWT required)
   ├─> Query filters:
   │   ├─> type: 'incoming' (current user = target)
   │   ├─> type: 'outgoing' (current user = requester)
   │   └─> status: pending/accepted/rejected
   └─> Return filtered list

3. ACCEPT PAYMENT REQUEST
   POST /api/v1/requests/:id/accept
   ├─> Authentication (JWT required)
   ├─> Verify current user is target (access control)
   ├─> Check request status is still pending
   └─> Service Layer (ATOMIC):
       ├─> Start MongoDB Session
       ├─> Execute atomic TRANSFER:
       │   ├─> Lock accounts
       │   ├─> Validate balance
       │   ├─> Update balances
       │   └─> Create Transaction (type: request_accept)
       ├─> Update request (status: accepted, respondedAt: now)
       ├─> Link transaction to request
       ├─> Commit transaction
       └─> Emit Socket.IO:
           ├─> payment_request_accepted → requester
           └─> payment_received → requester

4. REJECT PAYMENT REQUEST
   POST /api/v1/requests/:id/reject
   ├─> Authentication (JWT required)
   ├─> Verify current user is target (access control)
   ├─> Update request (status: rejected, respondedAt: now)
   ├─> NO transfer occurs
   └─> Emit Socket.IO: payment_request_rejected → requester
```

### Middleware Stack
```
Request
  ↓
├─> CORS Middleware (cross-origin requests)
├─> Helmet (security headers)
├─> Body Parser (JSON parsing, 50MB limit)
├─> Morgan (request logging with format: dev)
├─> Authentication Middleware (JWT verification)
├─> General Rate Limiter (100 req/15min)
├─> Endpoint-Specific Rate Limiters:
│   ├─> Auth: 20 req/15min
│   ├─> Transfer: 10 req/min (STRICT)
│   ├─> Requests: 50 req/15min
│   └─> OTP: 5 req/min
├─> Route Handler (business logic)
  ↓
├─> Try-Catch (async error handling)
├─> Validation (Zod schemas)
├─> Service Layer (transactions, atomicity)
├─> Database Operations
├─> Socket.IO Emission (real-time)
  ↓
└─> Response/Error Handler
```

### Socket.IO Real-time Events ⭐ NEW

**Connection**:
```javascript
// Client connects with JWT
socket = io('http://localhost:8080', {
  auth: {
    token: localStorage.getItem('token')
  }
})

// Server validates JWT in socket middleware
// User joins room: `user:<userId>`
```

**Events** (emitted by server):
```javascript
// Payment received notification
socket.on('payment_received', {
  transactionId: "...",
  amount: 100,
  senderId: "userId",
  senderName: "John Doe",
  type: "transfer",
  createdAt: "2024-01-16T..."
})

// Payment request created
socket.on('payment_request', {
  requestId: "...",
  requesterId: "userId",
  requesterName: "Jane Doe",
  amount: 50,
  note: "Lunch money",
  createdAt: "2024-01-16T..."
})

// Payment request accepted
socket.on('payment_request_accepted', {
  requestId: "...",
  amount: 50,
  acceptedBy: "userId",
  transactionId: "...",
  timestamp: "2024-01-16T..."
})

// Payment request rejected
socket.on('payment_request_rejected', {
  requestId: "...",
  amount: 50,
  rejectedBy: "userId",
  timestamp: "2024-01-16T..."
})
```

---

## Module Details

### Backend Modules

#### **models/** - Data Models ⭐ NEW
- **transaction.js**: Immutable ledger of all financial transactions
  - Indexed for efficient querying
  - Type field for different transaction types
  - Status tracking (pending/success/failed)
  - Metadata for extended information
  
- **paymentRequest.js**: Payment request workflow
  - Requester and target parties
  - Status tracking (pending/accepted/rejected/cancelled)
  - Links to related transaction on acceptance

#### **services/transferService.js** ⭐ NEW - Business Logic Layer
- **transfer()**: Atomic transfer with MongoDB sessions
  - Validates sender and receiver exist
  - Checks sufficient balance
  - Locks accounts (prevents race conditions)
  - Updates balances atomically
  - Creates transaction ledger entry
  - Returns transaction data
  
- **getTransactions()**: Paginated transaction retrieval
  - Aggregates sender + receiver transactions
  - Supports pagination (limit, page)
  - Sorts by creation date
  
- **getTransactionStats()**: Statistics aggregation
  - MongoDB $facet pipeline
  - Calculates totalSent, totalReceived, count
  
- **getMonthlyStats()**: 6-month breakdown
  - Groups by year/month
  - Separates sent/received
  - Used for charts in analytics

#### **socket.js** ⭐ NEW - Real-time Communication
- **Socket.IO server initialization**
  - JWT middleware for authentication
  - User joins `user:<userId>` room
  
- **Utility functions**
  - emitToUser(): Send to specific user
  - emitPaymentReceived(): Notify payment received
  - emitPaymentRequest(): Notify payment request
  - emitRequestAccepted/Rejected(): Notify request status

#### **security.js** ⭐ NEW - Security Middleware
- **securityHeaders()**: Helmet configuration
  - XSS protection
  - Frame options
  - HSTS headers
  
- **Rate Limiters**: Configurable per endpoint
  - generalLimiter: 100 req/15min
  - authLimiter: 20 req/15min
  - transferLimiter: 10 req/min (STRICT)
  - requestLimiter: 50 req/15min
  - otpLimiter: 5 req/min

#### **db.js** - Database Layer
- Establishes MongoDB connection
- Defines all schemas (User, Account, OTP)
- Implements Mongoose models
- Password hashing methods
- OTP TTL management

#### **routes/** - API Endpoints
- **user.js**: Registration, login, profile management
- **account.js**: Balance queries, account details
- **otp.js**: OTP generation and verification
- **transactions.js** ⭐ NEW: Transfer, history, stats, monthly breakdown
  - POST /transfer - Create atomic transfer
  - GET / - List transactions (paginated)
  - GET /stats - Get user statistics
  - GET /monthly - Get monthly breakdown
  - GET /:id - Get specific transaction
  
- **requests.js** ⭐ NEW: Payment request workflow
  - POST / - Create payment request
  - GET / - List requests with filtering
  - GET /:id - Get specific request
  - POST /:id/accept - Accept with atomic transfer
  - POST /:id/reject - Reject request
  
- **index.js**: Route aggregation

#### **middlewares/middleware.js** - Middleware Layer
- JWT token verification
- Request validation
- Error handling
- Request logging with morgan

#### **utils/mailSender.js** - Email Service
- SMTP configuration (Gmail)
- Email template building
- Error handling and retry logic
- Support for HTML emails

#### **validations/schemas.js** - Validation Layer
- Zod schemas for all inputs
- Request body validation
- Error message customization
- Type safety

#### **scripts/backfill-transactions.js** ⭐ NEW - Data Migration
- **backfill()**: Create transaction entries for existing balances
  - Ensures initial balances are recorded in ledger
  - Used when upgrading from v1.0
  
- **verify()**: Data integrity checks
  - Validates transaction totals match balances
  - Reports discrepancies

#### **tests/** ⭐ NEW - Automated Testing
- **transfer.test.js**: Transfer service unit tests (15 cases)
  - Atomic operations
  - Balance validation
  - Concurrent transfer handling
  
- **transactions.test.js**: Route endpoint tests (12 cases)
  - Transfer endpoint validation
  - Transaction retrieval
  - Statistics calculation
  
- **requests.test.js**: Payment request workflow tests (16 cases)
  - Create/accept/reject flows
  - Access control verification
  - Budget validation

#### **config.js** - Configuration
- Environment variable management
- Default values
- API constants

#### **index.js** - Server Entry Point
- Express app initialization
- HTTP server for Socket.IO
- Middleware setup
- Socket.IO configuration
- Route registration
- Error handlers
- Server startup

### Frontend Modules

#### **hooks/useSocket.jsx** ⭐ NEW - Real-time Integration
- **useSocket()**: Custom React hook
  - Manages Socket.IO connection with JWT
  - Event listeners (payment_received, payment_request, etc.)
  - Event emitters (confirmations)
  - Auto-reconnect with exponential backoff
  - Connection state management

#### **components/TransactionHistory.jsx** ⭐ NEW
- Displays paginated transaction list
- Send/receive icons with color coding
- Transaction status badges
- Date formatting
- User information display

#### **components/PaymentRequests.jsx** ⭐ NEW
- Create payment request form
- List incoming requests with Accept/Reject
- List outgoing requests with status
- Real-time status updates via Socket.IO

#### **components/Analytics.jsx** ⭐ NEW
- Statistics cards (total sent, received, count)
- 6-month line chart using Recharts
- Transaction count bar chart
- Summary statistics display

#### **components/** - UI Components
- Stateless/presentational components
- Reusable across pages
- Styled with Tailwind CSS

#### **store/** - State Management
- Redux store configuration
- User slice for state management
- Actions and reducers
- Thunks for async operations

#### **utils/axios.jsx** - HTTP Client
- API base URL configuration
- Request/response interceptors
- Authentication header injection
- Error handling

#### **App.jsx** - Main App Component
- Route definitions
- Layout structure
- Provider setup

---

## Deployment Architecture

### Docker Architecture
```
┌──────────────────────────────────────┐
│         Docker Compose               │
├──────────────────────────────────────┤
│                                      │
│  ┌─────────────────────────────┐   │
│  │   Frontend Container        │   │
│  │  Port: 3000 (served)        │   │
│  │  Base Image: node:18-alpine │   │
│  │  Multi-stage build          │   │
│  └─────────────────────────────┘   │
│                                    │
│  ┌─────────────────────────────┐   │
│  │   Backend Container         │   │
│  │  Port: 8080                 │   │
│  │  Base Image: node:18-alpine │   │
│  │  Health check enabled       │   │
│  └─────────────────────────────┘   │
│                                    │
│  ┌─────────────────────────────┐   │
│  │  MongoDB Container          │   │
│  │  Port: 27017                │   │
│  │  Image: mongo:7.0           │   │
│  │  Persistent volume storage  │   │
│  └─────────────────────────────┘   │
│                                    │
│  ┌─────────────────────────────┐   │
│  │  swiftpay-network           │   │
│  │  (Bridge network)           │   │
│  └─────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Container Network Communication
- **Frontend** → **Backend**: `http://swiftpay-backend:8080/api/v1`
- **Backend** → **MongoDB**: `mongodb://username:password@mongodb:27017`
- **Frontend** ← **External Network**: Port 3000
- **Backend** ← **External Network**: Port 8080

---

## Environment Configuration

### Required Environment Variables
```
# Database
MONGODB_URI=mongodb://localhost:27017/SwiftPayDB
MONGODB_USER=admin
MONGODB_PASSWORD=password

# Server
PORT=8080
NODE_ENV=production

# Security
JWT_SECRET=your_secret_key

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# OTP
OTP_EXPIRY=120
```

---

## Security Considerations

1. **Password Security**
   - Bcrypt hashing with salt rounds: 10
   - Never store plain text passwords
   - Hash comparison for validation

2. **Authentication**
   - JWT tokens for stateless auth
   - Token expiration (configurable)
   - Secure token transmission (HTTPS)

3. **Data Validation**
   - Zod schema validation
   - Type checking at runtime
   - Input sanitization

4. **Email Security**
   - App-specific passwords (not main account)
   - SMTP with TLS
   - Secure credential storage in .env

5. **API Security**
   - CORS whitelist configuration
   - Rate limiting (recommended)
   - Request validation middleware

6. **Container Security**
   - Alpine Linux (minimal attack surface)
   - Health checks enabled
   - Resource limits (recommended)

---

## Performance Optimization

1. **Frontend**
   - Tree-shaking with Vite
   - Code splitting per route
   - Image optimization
   - CSS purging with Tailwind

2. **Backend**
   - Connection pooling (MongoDB)
   - Request compression
   - Response caching (optional)
   - Database indexing

3. **Docker**
   - Multi-stage builds for frontend
   - Alpine Linux (small image size)
   - Layer caching
   - Resource constraints (optional)

---

## Scaling Considerations

### Horizontal Scaling
- Stateless backend instances behind load balancer
- Database replication (MongoDB Atlas)
- Session storage in Redis (if needed)

### Vertical Scaling
- Increase container resource limits
- Database memory and CPU allocation
- Network bandwidth optimization

### Caching Strategy
- Redis for session/token caching
- CDN for static assets
- API response caching

---

## Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [Zod Validation](https://zod.dev/)
