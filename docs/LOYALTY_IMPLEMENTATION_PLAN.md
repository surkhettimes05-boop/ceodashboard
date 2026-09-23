# Pasalho POS - Customer Loyalty + Feedback + Complaint System
## Implementation Plan

**Date**: 2024-01-19  
**Status**: Phase 1 Complete - Audit Done

---

## Phase 1: Audit Complete ✅

### Existing Architecture Identified

**Backend Stack**:
- Node.js/Express with TypeScript
- Prisma ORM with PostgreSQL
- Zod for validation
- JWT authentication with RBAC (Role, Permission, RolePermission)
- Decimal.js for financial calculations
- Audit logging service
- Rate limiting middleware

**Frontend Stack**:
- React 18 with TypeScript + Vite
- Radix UI components
- Zustand for state management
- React Router
- i18next for internationalization
- Lucide React icons
- Axios for API calls

**Database Schema**:
- Customer model exists: id, code, name, phone, email, is_b2b, credit_limit, outstanding_balance, credit_hold, aging fields
- Sale model has customer_id (nullable) - already supports guest checkout
- User model with RBAC
- Branch, Product, SaleItem, SalePayment models exist

**Existing Services**:
- CustomersService: CRUD operations
- SalesService: createSaleTransaction (atomic with inventory + accounting)
- AuthService: JWT authentication
- AuditService: audit logging
- AnalyticsService: executive dashboard metrics

**POS UI**:
- Already has customer selection (selectedCustomerId)
- Cart, payment, checkout flow exists
- Toast notifications available
- Uses axios for API calls

**Key Findings**:
1. Customer model exists but lacks loyalty fields
2. Sale.customer_id is nullable - guest checkout already supported
3. RBAC system exists with permissions
4. Audit logging service exists
5. Atomic transaction pattern exists in SalesService
6. CEO Tower analytics service exists

---

## Phase 2: Customer Entity Extension

### Database Schema Changes

**Extend Customer Model**:
```prisma
model Customer {
  // Existing fields...
  
  // New loyalty fields
  loyalty_points_balance   Decimal  @default(0) @db.Decimal(12, 0)
  lifetime_spend          Decimal  @default(0) @db.Decimal(12, 2)
  total_orders            Int      @default(0)
  first_purchase_at       DateTime?
  last_purchase_at        DateTime?
  date_of_birth           DateTime?
  gender                  String?
  address                 String?
  status                  String   @default("ACTIVE") // ACTIVE, INACTIVE
  
  // New relations
  loyalty_transactions    LoyaltyTransaction[]
  feedbacks               Feedback[]
  complaints              Complaint[]
}
```

**Create LoyaltyTransaction Model**:
```prisma
model LoyaltyTransaction {
  id              String              @id @default(uuid())
  customer_id     String
  sale_id         String?
  type            LoyaltyTransactionType
  points          Decimal             @db.Decimal(12, 0)
  balance_after   Decimal             @db.Decimal(12, 0)
  description     String
  created_by      String?
  created_at      DateTime            @default(now())
  
  customer        Customer            @relation(fields: [customer_id], references: [id])
  sale            Sale?               @relation(fields: [sale_id], references: [id])
  
  @@index([customer_id])
  @@index([sale_id])
  @@map("loyalty_transactions")
}

enum LoyaltyTransactionType {
  EARN
  REDEEM
  ADJUSTMENT
  EXPIRE
  REVERSAL
  REFUND_REVERSAL
}
```

**Create LoyaltySettings Model**:
```prisma
model LoyaltySettings {
  id                    String   @id @default(uuid())
  points_per_currency   Decimal  @default(1) @db.Decimal(12, 0)
  currency_per_point    Decimal  @default(100) @db.Decimal(12, 2)
  minimum_redeem_points Int      @default(100)
  points_value          Decimal  @default(1) @db.Decimal(12, 2) // Rs per point
  active                Boolean  @default(true)
  updated_at            DateTime @updatedAt
  
  @@map("loyalty_settings")
}
```

**Create Feedback Model**:
```prisma
model Feedback {
  id              String          @id @default(uuid())
  transaction_id  String
  customer_id     String?
  store_id        String
  rating          Int             // 1-5
  category        String
  comment         String?
  photo_url       String?
  created_at      DateTime        @default(now())
  
  transaction     Sale            @relation(fields: [transaction_id], references: [id])
  customer        Customer?       @relation(fields: [customer_id], references: [id])
  store           Branch          @relation(fields: [store_id], references: [id])
  
  @@index([customer_id])
  @@index([transaction_id])
  @@index([store_id])
  @@map("feedbacks")
}
```

**Create Complaint Model**:
```prisma
model Complaint {
  id              String              @id @default(uuid())
  ticket_number   String              @unique
  customer_id     String?
  transaction_id  String?
  store_id        String
  category        String
  priority        ComplaintPriority   @default(MEDIUM)
  description     String
  status          ComplaintStatus     @default(OPEN)
  assigned_to     String?
  resolution      String?
  resolved_at     DateTime?
  closed_at       DateTime?
  created_at      DateTime            @default(now())
  updated_at      DateTime            @updatedAt
  
  customer        Customer?           @relation(fields: [customer_id], references: [id])
  transaction     Sale?               @relation(fields: [transaction_id], references: [id])
  store           Branch              @relation(fields: [store_id], references: [id])
  
  @@index([customer_id])
  @@index([store_id])
  @@index([status])
  @@map("complaints")
}

enum ComplaintPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum ComplaintStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

**Update Sale Model**:
```prisma
model Sale {
  // Existing fields...
  
  // New relations
  loyalty_transaction  LoyaltyTransaction?
  feedbacks             Feedback[]
}
```

**Migration**: `add_loyalty_system`

---

## Phase 3: Customer Lookup/Creation in POS

### Backend Changes

**CustomersService Extensions**:
- `lookupCustomerByPhone(phone: string)` - Normalize phone, search customer
- `createCustomerFromPOS(phone: string, name: string)` - Fast customer creation
- `getCustomerLoyaltySummary(customerId: string)` - Get loyalty info for POS

**API Endpoints**:
- `GET /api/customers/lookup?phone=98XXXXXXXX` - Lookup by phone
- `POST /api/customers/pos-create` - Fast POS customer creation

### Frontend Changes

**POSView.tsx Extensions**:
- Add phone number input field
- Add "Walk-in" vs "Enter Phone" toggle
- Display customer loyalty info when selected
- Show points balance, lifetime spend, visits

---

## Phase 4: Loyalty Ledger

### Backend Service

**LoyaltyService** (`backend/src/modules/loyalty/loyalty.service.ts`):
- `awardPoints(customerId, saleId, points, description)` - Award points
- `redeemPoints(customerId, points, description)` - Redeem points
- `adjustPoints(customerId, points, description, reason)` - Manual adjustment
- `reversePoints(saleId)` - Reverse points on refund
- `getLoyaltyLedger(customerId)` - Get transaction history
- `getLoyaltyBalance(customerId)` - Get current balance
- `calculatePoints(saleAmount)` - Calculate points from sale

**LoyaltyTransaction Schema**:
- Validation for point operations
- Ensure balance never goes negative

---

## Phase 5: Automatic Points on Completed Sales

### Modify SalesService

**Extend createSaleTransaction**:
- After successful sale creation
- If customer_id is present
- Calculate points based on loyalty settings
- Create loyalty transaction
- Update customer loyalty fields (balance, lifetime_spend, total_orders, last_purchase_at)

**Transaction Safety**:
- All operations within existing $transaction
- Points only awarded if sale succeeds
- Use sale_id as idempotency key

---

## Phase 6: Receipt Integration

### Backend Changes

**SaleService Extensions**:
- Return loyalty info in sale response
- Generate feedback token for QR code

### Frontend Changes

**POSView.tsx**:
- Display points earned after checkout
- Display new balance
- Generate QR code with feedback URL
- Show feedback message on receipt

**Feedback Token**:
- Secure token identifying transaction
- Format: `/feedback/<token>`
- Token contains: transaction_id, store_id, timestamp, signature

---

## Phase 7: Feedback QR + Feedback Page

### Backend

**FeedbackService** (`backend/src/modules/feedback/feedback.service.ts`):
- `validateFeedbackToken(token)` - Validate and decode token
- `submitFeedback(token, rating, category, comment, photo)` - Submit feedback
- `getFeedbackByTransaction(transactionId)` - Get feedback for transaction

**API Endpoints**:
- `POST /api/feedback/submit` - Public endpoint for feedback submission
- `GET /api/feedback/validate/:token` - Validate token
- `GET /api/feedback/transaction/:transactionId` - Get feedback (admin)

### Frontend - Public Feedback Page

**New Route**: `/feedback/:token`
- Mobile-friendly page
- No login required
- Star rating (1-5)
- Category checkboxes
- Optional comment
- Optional photo upload
- Thank you message after submission

---

## Phase 8: Complaint Ticketing

### Backend Service

**ComplaintService** (`backend/src/modules/complaints/complaints.service.ts`):
- `createComplaint(customerId, transactionId, storeId, category, description)` - Create ticket
- `assignComplaint(ticketId, assignedTo)` - Assign ticket
- `updateStatus(ticketId, status)` - Update status
- `addResolution(ticketId, resolution)` - Add resolution
- `closeComplaint(ticketId)` - Close ticket
- `getComplaints(storeId, status)` - Get complaints for store
- `getComplaint(ticketId)` - Get single complaint

**API Endpoints**:
- `POST /api/complaints` - Create complaint
- `PUT /api/complaints/:id/assign` - Assign
- `PUT /api/complaints/:id/status` - Update status
- `PUT /api/complaints/:id/resolve` - Add resolution
- `PUT /api/complaints/:id/close` - Close
- `GET /api/complaints` - List complaints (filtered by role)

### Frontend

**Complaint Management Component**:
- Ticket list
- Ticket detail view
- Status transitions
- Assignment UI
- Resolution form

---

## Phase 9: Store Manager Dashboard

### Backend Extensions

**AnalyticsService Extensions**:
- `getCustomerExperienceMetrics(storeId, dateRange)` - Get CX metrics
- Metrics: feedback count, rating average, complaints, resolution time

### Frontend Extensions

**Store Manager Dashboard**:
- Add "Customer Experience" section
- Show today's feedback, complaints, open tickets
- Show average rating
- Show complaint list with status
- Allow ticket management

---

## Phase 10: CEO Tower Integration

### Backend Extensions

**AnalyticsService Extensions**:
- `getCustomerLoyaltyMetrics(dateRange)` - Loyalty metrics
- `getCustomerExperienceMetrics(dateRange)` - CX metrics

**Metrics**:
- Total customers, new customers, active customers
- Repeat purchase rate
- Customer lifetime spend
- Average customer spend
- Average basket size
- Loyalty members
- Points issued, redeemed, outstanding
- Average rating, total feedback, complaints
- Resolution time by category

### Frontend Extensions

**CEODashboardView.tsx**:
- Add "Customer & Loyalty" section
- Add "Customer Experience" section
- Display all metrics
- Add filtering by date, store, category

---

## Phase 11: Refund/Cancellation/Reversal

### Backend Changes

**SalesService Extensions**:
- When sale is voided/cancelled
- Call LoyaltyService.reversePoints(saleId)
- Create REFUND_REVERSAL transaction

**LoyaltyService**:
- `reversePoints(saleId)` - Find and reverse loyalty transaction
- Ensure balance doesn't go negative

---

## Phase 12: Tests + Security + Audit

### Tests

**Unit Tests**:
- LoyaltyService: award, redeem, adjust, reverse
- FeedbackService: token validation, submission
- ComplaintService: CRUD, status transitions

**Integration Tests**:
- Complete POS flow with loyalty
- Refund with point reversal
- Feedback submission
- Complaint workflow

### Security

**RBAC Permissions**:
- `CUSTOMER_LOOKUP` - POS
- `CUSTOMER_CREATE` - POS
- `LOYALTY_VIEW` - POS, STORE_MANAGER
- `LOYALTY_REDEEM` - POS (with permission)
- `CUSTOMER_VIEW` - STORE_MANAGER, ADMIN
- `FEEDBACK_VIEW` - STORE_MANAGER, ADMIN
- `COMPLAINT_VIEW` - STORE_MANAGER, ADMIN
- `COMPLAINT_MANAGE` - STORE_MANAGER, ADMIN
- `LOYALTY_SETTINGS` - ADMIN
- `LOYALTY_ADJUSTMENT` - ADMIN
- `CUSTOMER_MANAGEMENT` - ADMIN
- `COMPLAINT_MANAGEMENT` - ADMIN

### Audit Logging

Log sensitive actions:
- Manual point adjustments
- Point redemptions
- Complaint reassignment
- Complaint closure

---

## Phase 13: End-to-End Testing

### Complete Scenario Test

1. Customer walks in
2. Cashier enters phone
3. Customer found, points displayed
4. Complete sale
5. Payment succeeds
6. Points awarded
7. Receipt prints with QR
8. Customer scans QR
9. Submits feedback
10. Complaint created if needed
11. Manager sees complaint
12. Manager resolves
13. CEO Tower reflects metrics
14. Refund reverses points
15. Retry doesn't duplicate points

---

## Files to Create

### Backend
- `backend/src/modules/loyalty/loyalty.service.ts`
- `backend/src/modules/loyalty/loyalty.schema.ts`
- `backend/src/modules/loyalty/loyalty.routes.ts`
- `backend/src/modules/loyalty/loyalty.controller.ts`
- `backend/src/modules/feedback/feedback.service.ts`
- `backend/src/modules/feedback/feedback.schema.ts`
- `backend/src/modules/feedback/feedback.routes.ts`
- `backend/src/modules/feedback/feedback.controller.ts`
- `backend/src/modules/complaints/complaints.service.ts`
- `backend/src/modules/complaints/complaints.schema.ts`
- `backend/src/modules/complaints/complaints.routes.ts`
- `backend/src/modules/complaints/complaints.controller.ts`
- `backend/prisma/migrations/add_loyalty_system/migration.sql`

### Frontend
- `frontend/src/modules/pos/CustomerLookup.tsx` (new component)
- `frontend/src/modules/feedback/FeedbackPage.tsx` (new public page)
- `frontend/src/modules/complaints/ComplaintManagement.tsx` (new component)
- `frontend/src/modules/customers/CustomerProfile.tsx` (new component)

### Tests
- `backend/tests/integration/loyalty.integration.test.ts`
- `backend/tests/integration/feedback.integration.test.ts`
- `backend/tests/integration/complaints.integration.test.ts`

---

## Assumptions

1. Phone number normalization: Nepal format (98XXXXXXXX)
2. Loyalty rule: Rs 100 = 1 point (configurable)
3. Redemption: 100 points = Rs 100 (configurable)
4. Feedback token: JWT with transaction_id, store_id, timestamp
5. No mobile app for V1 - web-based feedback only
6. Photo upload optional (if storage infrastructure exists)

---

## Production Risks

1. **Performance**: Loyalty calculation in sale transaction - mitigate with efficient queries
2. **Data Integrity**: Ensure atomic operations - use existing transaction pattern
3. **Security**: Feedback token must be secure - use JWT with short expiry
4. **Scalability**: Large loyalty ledger - add indexes, consider partitioning
5. **Backward Compatibility**: Existing POS must continue working - customer_id nullable

---

## Next Steps

Proceed to Phase 2: Customer Entity Extension + Migration
