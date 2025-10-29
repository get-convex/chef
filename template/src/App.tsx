import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { CartPage } from "./pages/CartPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("home");
  const currentUser = useQuery(api.auth.loggedInUser);
  const setInitialRole = useMutation(api.storeRoles.setInitialRole);
  const userRole = useQuery(api.storeRoles.getMyRole);

  // Handle role assignment for new users
  useEffect(() => {
    if (currentUser && !userRole) {
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
          {currentPage === "cart" && (
            <CartPage setCurrentPage={setCurrentPage} />
          )}
          {currentPage === "orders" && <OrdersPage />}
          {currentPage === "admin" && <AdminDashboard />}
        </main>
      </Authenticated>

      <Unauthenticated>
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <div className="w-full max-w-md mx-auto">
            <div className="flex flex-col gap-section">
              <div className="text-center">
                <div className="mb-6">
                  <div className="text-7xl mb-4 animate-bounce">🛒</div>
                  <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                    Chef Store
                  </h1>
                  <p className="text-xl text-gray-600">
                    Your premium shopping destination
                  </p>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-gray-100">
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
