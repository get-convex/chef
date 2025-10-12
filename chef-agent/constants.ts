export const SUGGESTIONS = [
  {
    title: 'E-Commerce Store',
    prompt: `Build a fully-featured online store with product listing, shopping cart, checkout, order management, and admin dashboard. Include the following features:

- Product catalog with search and filtering
- Shopping cart with add/remove items and quantity updates
- Checkout process that creates orders
- User order history
- Admin dashboard for product management (create, update, delete)
- Admin dashboard for viewing and managing all orders
- Role-based access control (user and admin roles)
- Real-time updates for product availability and order status`,
  },
];

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

export const PREWARM_PATHS = [
  `${WORK_DIR}/package.json`,
  `${WORK_DIR}/convex/schema.ts`,
  `${WORK_DIR}/convex/products.ts`,
  `${WORK_DIR}/convex/cart.ts`,
  `${WORK_DIR}/convex/orders.ts`,
  `${WORK_DIR}/convex/roles.ts`,
  `${WORK_DIR}/src/App.tsx`,
  `${WORK_DIR}/src/pages/HomePage.tsx`,
  `${WORK_DIR}/src/components/ProductCard.tsx`,
  `${WORK_DIR}/src/index.css`,
];

// A list of files that we block the LLM from modifying
export const EXCLUDED_FILE_PATHS = [
  'convex/auth.ts',
  'convex/http.ts',
  'src/main.tsx',
  'src/SignInForm.tsx',
  'src/SignOutButton.tsx',
  'vite.config.ts',
  'package.json',
];
