export const SUGGESTIONS = [
  {
    title: 'E-Commerce Store',
    prompt: `I want to customize the e-commerce store. Can you show me what's already implemented and help me make some changes?`,
  },
  {
    title: 'Product Categories',
    prompt: `Add product categories to the e-commerce store so products can be organized and filtered by category.`,
  },
  {
    title: 'Product Search',
    prompt: `Add a search feature to the product listing page so users can search for products by name or description.`,
  },
];

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

export const PREWARM_PATHS = [
  `${WORK_DIR}/package.json`,
  `${WORK_DIR}/convex/schema.ts`,
  `${WORK_DIR}/convex/storeProducts.ts`,
  `${WORK_DIR}/convex/storeCart.ts`,
  `${WORK_DIR}/convex/storeOrders.ts`,
  `${WORK_DIR}/convex/storeRoles.ts`,
  `${WORK_DIR}/convex/router.ts`,
  `${WORK_DIR}/src/App.tsx`,
  `${WORK_DIR}/src/pages/HomePage.tsx`,
  `${WORK_DIR}/src/pages/CartPage.tsx`,
  `${WORK_DIR}/src/pages/OrdersPage.tsx`,
  `${WORK_DIR}/src/pages/AdminDashboard.tsx`,
  `${WORK_DIR}/src/components/Navbar.tsx`,
  `${WORK_DIR}/src/components/ProductCard.tsx`,
  `${WORK_DIR}/src/index.css`,
];

// A list of files that we block the LLM from modifying
export const EXCLUDED_FILE_PATHS = [
  'convex/auth.ts',
  'convex/http.ts',
  'convex/router.ts',
  'src/main.tsx',
  'src/SignInForm.tsx',
  'src/SignOutButton.tsx',
  'vite.config.ts',
  'package.json',
];
