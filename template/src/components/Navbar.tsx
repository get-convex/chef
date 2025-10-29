import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export function Navbar({ currentPage, setCurrentPage }: NavbarProps) {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const role = useQuery(api.storeRoles.getMyRole);
  const cart = useQuery(api.storeCart.getCart) ?? [];

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <button
            onClick={() => setCurrentPage("home")}
            className="flex items-center gap-3 group"
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">🛒</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Chef Store
            </span>
          </button>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage("home")}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                currentPage === "home"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              🏠 Home
            </button>
            <button
              onClick={() => setCurrentPage("cart")}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all relative ${
                currentPage === "cart"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              🛒 Cart
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentPage("orders")}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                currentPage === "orders"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              📦 Orders
            </button>
            {role === "admin" && (
              <button
                onClick={() => setCurrentPage("admin")}
                className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                  currentPage === "admin"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                    : "text-gray-700 hover:bg-gray-100 border border-amber-300"
                }`}
              >
                👨‍💼 Admin
              </button>
            )}
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-4">
            {loggedInUser && (
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                <span className="text-xl">👤</span>
                <span className="text-sm font-medium text-gray-700">
                  {loggedInUser.email || "Guest"}
                </span>
                {role === "admin" && (
                  <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                    ADMIN
                  </span>
                )}
              </div>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
