import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { CartPage } from "./pages/CartPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ProductsPage } from "./pages/ProductsPage";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("home");
  const currentUser = useQuery(api.auth.loggedInUser);
  const setInitialRole = useMutation(api.storeRoles.setInitialRole);
  const userRole = useQuery(api.storeRoles.getMyRole);

  // Handle role assignment for new users
  useEffect(() => {
    if (currentUser && (userRole === "user" || userRole === null)) {
      const pendingRole = localStorage.getItem("pendingRole");
      if (pendingRole) {
        setInitialRole({ role: pendingRole }).catch(console.error);
        localStorage.removeItem("pendingRole");
      }
    }
  }, [currentUser, userRole, setInitialRole]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Authenticated>
        <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <main className="flex-1">
          {currentPage === "home" && (
            <HomePage setCurrentPage={setCurrentPage} />
          )}
          {currentPage === "products" && (
            <ProductsPage setCurrentPage={setCurrentPage} />
          )}
          {currentPage === "cart" && (
            <CartPage setCurrentPage={setCurrentPage} />
          )}
          {currentPage === "orders" && <OrdersPage />}
          {currentPage === "admin" && <AdminDashboard />}
        </main>
      </Authenticated>

      <Unauthenticated>
        <div className="auth-page">
          <div className="auth-container">
            <div className="auth-header">
              <div className="auth-branding">
                <div className="auth-logo">
                  <div className="auth-logo-icon">🛒</div>
                  <h1 className="auth-logo-title">
                    Chef Store
                  </h1>
                  <p className="auth-logo-subtitle">
                    Your premium shopping destination
                  </p>
                </div>
              </div>
              <div className="auth-form-container">
                <SignInForm />
              </div>
            </div>
          </div>
        </div>
      </Unauthenticated>

      <Toaster />
    </div>
  );
}
