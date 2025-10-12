import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export function Navbar({ currentPage, setCurrentPage }: NavbarProps) {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const role = useQuery(api.roles.getMyRole);
  const cart = useQuery(api.cart.getCart) ?? [];

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setCurrentPage("home")}
            className="text-2xl font-bold text-primary hover:text-primary-hover"
          >
            🛒 Chef Store
          </button>
          <nav className="flex gap-4">
            <button
              onClick={() => setCurrentPage("home")}
              className={`px-3 py-2 rounded ${
                currentPage === "home"
                  ? "bg-primary text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Shop
            </button>
            <button
              onClick={() => setCurrentPage("cart")}
              className={`px-3 py-2 rounded flex items-center gap-2 ${
                currentPage === "cart"
                  ? "bg-primary text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Cart
              {cart.length > 0 && (
                <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentPage("orders")}
              className={`px-3 py-2 rounded ${
                currentPage === "orders"
                  ? "bg-primary text-white"
                  : "text-secondary hover:text-primary"
              }`}
            >
              My Orders
            </button>
            {role === "admin" && (
              <button
                onClick={() => setCurrentPage("admin")}
                className={`px-3 py-2 rounded ${
                  currentPage === "admin"
                    ? "bg-primary text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                Admin Dashboard
              </button>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {loggedInUser && (
            <span className="text-sm text-secondary">
              {loggedInUser.email || "Guest"}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
