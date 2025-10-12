# E-Commerce Template for Chef

A complete e-commerce application template built with Vite, React, and Convex.

## Features

- **Product Management**: Browse products, view details, and add to cart
- **Shopping Cart**: Add/remove items, update quantities, and checkout
- **Order Management**: View order history and track order status
- **Role-Based Access Control**: User and admin roles
- **Admin Dashboard**:
  - Create, update, and delete products
  - View and manage all orders
  - Update order status (pending, paid, shipped)
- **Authentication**: Powered by Convex Auth with password and anonymous login

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: TailwindCSS
- **Backend**: Convex (database, functions, real-time, auth)
- **Authentication**: Convex Auth (@convex-dev/auth)

## Environment Variables

The template requires the following environment variables:

- `VITE_CONVEX_URL`: Your Convex deployment URL
- `CONVEX_DEPLOY_KEY`: Your Convex deployment key (for backend deployment)

These are automatically configured when using Chef.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

This starts both the Vite frontend dev server and the Convex backend in parallel.

### 3. Create Your First Admin User

After registering and signing in:

1. Open your browser's developer console
2. Import the Convex client and run the `seedMyAdmin` mutation:

```javascript
// In browser console
const { useMutation } = await import("convex/react");
// Or call it via the Convex dashboard
```

Alternatively, use the Convex dashboard to run:

```
npx convex run roles:seedMyAdmin
```

This grants admin privileges to your current user account.

## Database Schema

### Tables

- **products**: Product catalog with title, description, price, image, and stock
- **cart**: User shopping cart items
- **orders**: Customer orders with items and status
- **roles**: User roles (admin/user) for access control
- **users**: User accounts (from Convex Auth)

## Roles & Permissions

### User Role (default)

- Browse products
- Add items to cart
- Place orders
- View own orders

### Admin Role

- All user permissions
- Create, update, and delete products
- View all orders
- Update order status

## Project Structure

```
template/ecommerce/
├── convex/              # Backend Convex functions
│   ├── schema.ts        # Database schema
│   ├── auth.ts          # Auth configuration
│   ├── products.ts      # Product CRUD operations
│   ├── cart.ts          # Shopping cart operations
│   ├── orders.ts        # Order management
│   └── roles.ts         # Role-based access control
├── src/
│   ├── components/      # React components
│   │   ├── Navbar.tsx
│   │   └── ProductCard.tsx
│   ├── pages/           # Page components
│   │   ├── HomePage.tsx
│   │   ├── CartPage.tsx
│   │   ├── OrdersPage.tsx
│   │   └── AdminDashboard.tsx
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # App entry point
│   └── index.css        # Global styles
└── package.json
```

## Available Scripts

- `npm run dev`: Start development server (frontend + backend)
- `npm run dev:frontend`: Start only the frontend dev server
- `npm run dev:backend`: Start only the Convex backend
- `npm run build`: Build for production
- `npm run lint`: Run linting and type checking

## Customization

### Adding Products

As an admin, use the Admin Dashboard to:

1. Navigate to "Manage Products"
2. Fill in product details (title, description, price, stock, image URL)
3. Click "Create Product"

### Styling

The app uses TailwindCSS with custom theme colors defined in `tailwind.config.js`:

- Primary: Indigo (#4F46E5)
- Secondary: Gray (#6B7280)
- Accent: Purple (#8B5CF6)

Modify these in `tailwind.config.js` to match your brand.

## Best Practices

1. **Authentication**: Always use `getAuthUserId()` in Convex functions to get the current user
2. **Role Checks**: Admin-only operations should verify the user's role
3. **Queries**: Use Convex indexes for efficient queries
4. **Real-time**: Convex queries (`useQuery`) automatically update in real-time
5. **Error Handling**: All mutations include try-catch with toast notifications

## Deployment

When deployed via Chef, the app is automatically configured with:

- Convex backend deployment
- Environment variables
- Authentication setup

For manual deployment, follow the [Convex deployment guide](https://docs.convex.dev/production/hosting).

## Support

For issues or questions:

- [Convex Documentation](https://docs.convex.dev)
- [Chef Documentation](https://chef.convex.dev)

## License

This template is part of the Chef project and follows the same license.
