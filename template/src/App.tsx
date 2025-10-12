import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { CartPage } from "./pages/CartPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Toaster } from "sonner";
import { useState } from "react";
import type { Id } from "../convex/_generated/dataModel";

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [selectedProductId, setSelectedProductId] =
    useState<Id<"products"> | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Authenticated>
        <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <main className="flex-1">
          {currentPage === "home" && (
            <HomePage
              setCurrentPage={setCurrentPage}
              setSelectedProductId={setSelectedProductId}
            />
          )}
          {currentPage === "cart" && (
            <CartPage setCurrentPage={setCurrentPage} />
          )}
          {currentPage === "orders" && <OrdersPage />}
          {currentPage === "admin" && <AdminDashboard />}
        </main>
      </Authenticated>

      <Unauthenticated>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md mx-auto">
            <div className="flex flex-col gap-section">
              <div className="text-center">
                <h1 className="text-5xl font-bold text-primary mb-4">
                  🛒 Chef Store
                </h1>
                <p className="text-xl text-secondary">
                  Sign in to start shopping
                </p>
              </div>
              <SignInForm />
            </div>
          </div>
        </div>
      </Unauthenticated>

      <Toaster />
    </div>
  );
}
