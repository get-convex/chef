import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface HomePageProps {
  setCurrentPage: (page: string) => void;
}

export function HomePage({ setCurrentPage }: HomePageProps) {
  const products = useQuery(api.storeProducts.listProducts) ?? [];
  const cart = useQuery(api.storeCart.getCart) ?? [];
  const role = useQuery(api.storeRoles.getMyRole);

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
        <div className="container mx-auto px-8 py-24">
          <div className="max-w-3xl">
            <h1 className="text-6xl font-bold mb-6 leading-tight">
              Welcome to Your Premium Shopping Experience
            </h1>
            <p className="text-xl mb-8 text-indigo-100">
              Discover curated collections, exclusive deals, and seamless shopping.
              Your journey to extraordinary products starts here.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentPage("cart")}
                className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                View Cart ({cart.length})
              </button>
              <button
                onClick={() => setCurrentPage("orders")}
                className="px-8 py-4 bg-indigo-500/30 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-indigo-500/40 transition-all border border-white/20"
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-100">
              <div className="text-5xl mb-4">📦</div>
              <div className="text-4xl font-bold text-indigo-600 mb-2">{products.length}</div>
              <div className="text-gray-600 font-medium">Products Available</div>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
              <div className="text-5xl mb-4">🛒</div>
              <div className="text-4xl font-bold text-purple-600 mb-2">{cart.length}</div>
              <div className="text-gray-600 font-medium">Items in Cart</div>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
              <div className="text-5xl mb-4">✨</div>
              <div className="text-4xl font-bold text-pink-600 mb-2">24/7</div>
              <div className="text-gray-600 font-medium">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-gray-900">Why Shop With Us?</h2>
            <p className="text-xl text-gray-600">Experience shopping the way it should be</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-gray-100">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Fast Delivery</h3>
              <p className="text-gray-600">Get your orders delivered quickly and securely to your doorstep.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-gray-100">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Secure Payments</h3>
              <p className="text-gray-600">Shop with confidence using our encrypted payment system.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-gray-100">
              <div className="text-4xl mb-4">🎁</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Best Prices</h3>
              <p className="text-gray-600">Competitive pricing and exclusive deals on premium products.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-gray-100">
              <div className="text-4xl mb-4">💖</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Quality Guaranteed</h3>
              <p className="text-gray-600">Every product is carefully curated for the best quality.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Shopping?</h2>
          <p className="text-xl mb-8 text-indigo-100 max-w-2xl mx-auto">
            Browse our collection and find exactly what you're looking for.
          </p>
          <button
            onClick={() => setCurrentPage("products")}
            className="px-10 py-5 bg-white text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
          >
            Explore Products →
          </button>
        </div>
      </section>

      {/* Admin Quick Access */}
      {role === "admin" && (
        <section className="py-12 bg-amber-50 border-t-4 border-amber-400">
          <div className="container mx-auto px-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-amber-900 mb-2">Admin Dashboard</h3>
                <p className="text-amber-700">Manage your store, products, and orders</p>
              </div>
              <button
                onClick={() => setCurrentPage("admin")}
                className="px-8 py-4 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
