# Chef E-Commerce Implementation Guide

## Overview

This document explains the complete implementation of the Chef E-Commerce Generator, which forces Chef to **always generate e-commerce applications** instead of other types of apps. The implementation involved 79 files across 2 commits and completely transformed how Chef works.

## What is Chef?

Chef is an AI-powered development environment that generates full-stack web applications. It uses:
- **Convex** as the backend (database, real-time, auth, functions)
- **React + Vite** for the frontend
- **TailwindCSS** for styling
- **Convex Auth** for authentication

## The Problem

Originally, Chef could generate any type of application (chat apps, todo lists, etc.). You wanted to force it to **only generate e-commerce applications** with a complete template.

## The Solution

The implementation works by modifying Chef's core configuration to:
1. **Replace the default template** with a complete e-commerce template
2. **Force the AI agent** to always generate e-commerce apps through system prompts
3. **Pre-warm the AI** with e-commerce-specific files

---

## Architecture Overview

```
Chef System
├── Template System (template/)
│   ├── Default template files
│   └── E-commerce template files
├── Agent Configuration (chef-agent/)
│   ├── Constants (what suggestions to show)
│   ├── System Prompts (how AI behaves)
│   └── Pre-warm paths (what files AI sees first)
└── Generated Applications
    └── Always e-commerce apps
```

---

## Part 1: Template System Changes

### What is the Template System?

Chef starts every new project with a **template** - a set of pre-written files that serve as the foundation. When you ask Chef to build something, it starts with these template files and modifies them.

### Template Structure

```
template/
├── convex/           # Backend files (Convex functions)
├── src/              # Frontend files (React components)
├── package.json      # Dependencies
├── index.html        # HTML entry point
└── ...config files
```

### Changes Made

#### 1. Created Complete E-Commerce Template (`template/ecommerce/`)

**Purpose**: A standalone, complete e-commerce application template

**Key Files Created**:

**Backend (Convex Functions)**:
- `convex/schema.ts` - Database schema with products, cart, orders, roles tables
- `convex/products.ts` - Product CRUD operations (create, read, update, delete)
- `convex/cart.ts` - Shopping cart operations (add, remove, update quantities)
- `convex/orders.ts` - Order management (place order, list orders, update status)
- `convex/roles.ts` - Role-based access control (admin/user roles)
- `convex/auth.ts` - Authentication configuration
- `convex/auth.config.ts` - Auth config file

**Frontend (React Components)**:
- `src/App.tsx` - Main app with routing logic
- `src/pages/HomePage.tsx` - Product listing page
- `src/pages/CartPage.tsx` - Shopping cart page
- `src/pages/OrdersPage.tsx` - Order history page
- `src/pages/AdminDashboard.tsx` - Admin management interface
- `src/components/Navbar.tsx` - Navigation component
- `src/components/ProductCard.tsx` - Product display component
- `src/SignInForm.tsx` - Authentication form
- `src/SignOutButton.tsx` - Logout button

**Configuration**:
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite configuration
- `tailwind.config.js` - TailwindCSS configuration
- `tsconfig.json` - TypeScript configuration

#### 2. Replaced Main Template (`template/`)

**Purpose**: Make the e-commerce template the default starting point

**What Happened**:
- Copied all e-commerce files from `template/ecommerce/` to `template/`
- Updated `package.json` to reflect e-commerce nature
- Changed app title from "Chef" to "Chef Store - E-Commerce"

**Result**: Every new Chef project now starts with a complete e-commerce application

---

## Part 2: Agent Configuration Changes

### What is the Agent Configuration?

The Chef AI agent has configuration files that control:
- What suggestions to show users
- How the AI behaves (system prompts)
- What files the AI sees first (pre-warm paths)

### Changes Made

#### 1. Updated Constants (`chef-agent/constants.ts`)

**Before**:
```typescript
export const SUGGESTIONS = [
  { title: 'Chat App', prompt: 'Build a chat application...' },
  { title: 'Todo App', prompt: 'Build a todo application...' },
  // ... other app types
];
```

**After**:
```typescript
export const SUGGESTIONS = [
  {
    title: 'E-Commerce Store',
    prompt: `Build a fully-featured online store with product listing, shopping cart, checkout, order management, and admin dashboard...`
  }
];
```

**Impact**: Users now only see "E-Commerce Store" as a suggestion

**Pre-warm Paths Updated**:
```typescript
export const PREWARM_PATHS = [
  `${WORK_DIR}/package.json`,
  `${WORK_DIR}/convex/schema.ts`,
  `${WORK_DIR}/convex/products.ts`,    // ← New
  `${WORK_DIR}/convex/cart.ts`,        // ← New
  `${WORK_DIR}/convex/orders.ts`,      // ← New
  `${WORK_DIR}/convex/roles.ts`,       // ← New
  `${WORK_DIR}/src/App.tsx`,
  `${WORK_DIR}/src/pages/HomePage.tsx`, // ← New
  `${WORK_DIR}/src/components/ProductCard.tsx`, // ← New
  `${WORK_DIR}/src/index.css`,
];
```

**Impact**: AI sees e-commerce files first, priming it to work with e-commerce concepts

#### 2. Updated System Prompts (`chef-agent/prompts/solutionConstraints.ts`)

**Added E-Commerce Only Section**:
```typescript
<ecommerce_only>
  # E-COMMERCE ONLY
  Always generate an e-commerce application. Do NOT generate other app types.
  The application MUST include:
  - Products table with listing, viewing, creating, updating, and deleting functionality
  - Shopping cart functionality (add, remove, update quantities)
  - Orders table with checkout and order history
  - Roles table for role-based access control (user and admin roles)
  - Admin dashboard for product management and order viewing
  
  Use the e-commerce template structure with:
  - Convex backend functions: products.ts, cart.ts, orders.ts, roles.ts
  - Frontend pages: HomePage (product listing), CartPage, OrdersPage, AdminDashboard
  - Frontend components: Navbar, ProductCard
  
  Do not modify locked Chef files. Add new files as needed following the e-commerce template pattern.
</ecommerce_only>
```

**Impact**: AI is explicitly instructed to ONLY generate e-commerce applications

---

## Part 3: How It All Works Together

### The Complete Flow

1. **User starts Chef** → Sees only "E-Commerce Store" suggestion
2. **User clicks suggestion** → AI receives e-commerce-focused system prompt
3. **AI starts working** → Sees e-commerce template files first (pre-warm paths)
4. **AI generates code** → Follows e-commerce-only constraints
5. **Result** → Complete e-commerce application

### Database Schema

The e-commerce template includes a complete database schema:

```typescript
// Products table
products: {
  title: string,
  description: string,
  price: number,
  image?: string,
  stock?: number,
  createdAt: number,
  updatedAt?: number
}

// Shopping cart table
cart: {
  userId: Id<"users">,
  productId: Id<"products">,
  quantity: number,
  addedAt: number
}

// Orders table
orders: {
  userId: Id<"users">,
  items: Array<{
    productId: Id<"products">,
    quantity: number,
    priceAtPurchase: number
  }>,
  total: number,
  status: string, // 'pending', 'paid', 'shipped'
  createdAt: number
}

// Roles table
roles: {
  userId: Id<"users">,
  role: string // 'admin' | 'user'
}
```

### Role-Based Access Control

**User Role (default)**:
- Browse products
- Add items to cart
- Place orders
- View own orders

**Admin Role**:
- All user permissions
- Create, update, delete products
- View all orders
- Update order status

### Frontend Architecture

**Main App Structure**:
```typescript
App.tsx
├── Authenticated
│   ├── Navbar (navigation + cart counter)
│   └── Main Content
│       ├── HomePage (product listing)
│       ├── CartPage (shopping cart)
│       ├── OrdersPage (order history)
│       └── AdminDashboard (admin management)
└── Unauthenticated
    └── SignInForm (authentication)
```

---

## Part 4: Technical Implementation Details

### Convex Backend Functions

**Products Management**:
- `listProducts()` - Get all products (public)
- `getProduct(id)` - Get single product
- `createProduct(data)` - Create product (admin only)
- `updateProduct(id, data)` - Update product (admin only)
- `deleteProduct(id)` - Delete product (admin only)

**Shopping Cart**:
- `getCart()` - Get user's cart items
- `addToCart(productId, quantity)` - Add item to cart
- `updateCartItem(id, quantity)` - Update cart item quantity
- `removeFromCart(id)` - Remove item from cart

**Orders**:
- `listOrdersForUser()` - Get user's orders
- `placeOrder(items, total)` - Create order from cart
- `listAllOrders()` - Get all orders (admin only)
- `updateOrderStatus(id, status)` - Update order status (admin only)

**Roles**:
- `getMyRole()` - Get current user's role
- `assignRole(userId, role)` - Assign role (admin only)
- `seedMyAdmin()` - Make current user admin

### React Frontend Components

**Pages**:
- `HomePage` - Product grid with search/filter capabilities
- `CartPage` - Cart items with quantity controls and checkout
- `OrdersPage` - Order history with status tracking
- `AdminDashboard` - Product management and order administration

**Components**:
- `Navbar` - Navigation with cart counter and role-based admin link
- `ProductCard` - Product display with add-to-cart functionality

### Authentication Flow

1. **Sign Up/Sign In** → User creates account or logs in
2. **Role Assignment** → User runs `seedMyAdmin()` to become admin
3. **Access Control** → Components check user role for admin features
4. **Real-time Updates** → Convex automatically updates UI when data changes

---

## Part 5: Why So Many Files Changed

### First Commit (51 files)
- Created complete e-commerce template (`template/ecommerce/`)
- Replaced main template files (`template/`)
- Updated agent configuration (`chef-agent/constants.ts`, `chef-agent/prompts/solutionConstraints.ts`)

### Second Commit (28 files)
- Code formatting fixes (Prettier/ESLint)
- Minor bug fixes and improvements
- Documentation updates

### File Categories

**Template Files** (34 files):
- Backend: `convex/*.ts` files
- Frontend: `src/**/*.tsx` files
- Config: `package.json`, `vite.config.ts`, etc.

**Agent Configuration** (2 files):
- `chef-agent/constants.ts`
- `chef-agent/prompts/solutionConstraints.ts`

**Documentation** (2 files):
- `ECOMMERCE_IMPLEMENTATION_SUMMARY.md`
- `template/ecommerce/README.md`

**Code Quality** (41 files):
- Formatting fixes across the codebase
- Linter error corrections

---

## Part 6: How to Use This System

### For Users

1. **Start Chef** → You'll see "E-Commerce Store" as the only suggestion
2. **Click suggestion** → Chef generates a complete e-commerce app
3. **Sign up** → Create your account
4. **Become admin** → Run `seedMyAdmin()` in browser console
5. **Add products** → Use admin dashboard to create products
6. **Test shopping** → Add items to cart and place orders

### For Developers

**To modify the e-commerce template**:
1. Edit files in `template/ecommerce/`
2. Copy changes to `template/` (main template)
3. Update agent configuration if needed

**To add new features**:
1. Add Convex functions in `template/convex/`
2. Add React components in `template/src/`
3. Update system prompts if behavior changes needed

**To change the app type**:
1. Replace template files with new app type
2. Update `SUGGESTIONS` in `constants.ts`
3. Update system prompts in `solutionConstraints.ts`
4. Update `PREWARM_PATHS` to include relevant files

---

## Part 7: Key Benefits

### For Users
- **Consistent Results**: Always get e-commerce apps, no confusion
- **Complete Template**: Full-featured app with admin dashboard
- **Role-Based Access**: User and admin roles built-in
- **Real-time Updates**: Convex provides live data updates

### For Developers
- **Predictable Behavior**: AI always generates e-commerce apps
- **Template System**: Easy to modify and extend
- **Configuration Control**: Clear separation of concerns
- **Documentation**: Comprehensive guides and examples

---

## Part 8: Troubleshooting

### Common Issues

**"Access Denied" on Admin Dashboard**:
- Solution: Run `seedMyAdmin()` in browser console

**Products not showing**:
- Solution: Create products using admin dashboard

**Cart not updating**:
- Solution: Check Convex deployment and authentication

**Build errors**:
- Solution: Run `npm install` and check TypeScript errors

### Debugging Steps

1. **Check Convex deployment**: Ensure backend is running
2. **Verify authentication**: User must be signed in
3. **Check browser console**: Look for JavaScript errors
4. **Verify admin role**: Run `getMyRole()` query

---

## Conclusion

The Chef E-Commerce implementation is a complete transformation of the Chef system that:

1. **Replaces the default template** with a complete e-commerce application
2. **Forces the AI agent** to only generate e-commerce apps through system prompts
3. **Pre-warms the AI** with e-commerce-specific files
4. **Provides a complete solution** with backend, frontend, and admin features

This implementation ensures that every Chef session results in a fully-functional e-commerce application with product management, shopping cart, order processing, and role-based access control.

The 79 files changed represent a complete system overhaul that transforms Chef from a general-purpose app generator into a specialized e-commerce application generator.
