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
    <main className="page-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="section-container-lg">
          <div className="hero-content">
            <h1 className="hero-title">
              Welcome to Your Premium Shopping Experience
            </h1>
            <p className="hero-description">
              Discover curated collections, exclusive deals, and seamless shopping.
              Your journey to extraordinary products starts here.
            </p>
            <div className="hero-actions">
              <button
                onClick={() => setCurrentPage("cart")}
                className="btn-white"
              >
                View Cart ({cart.length})
              </button>
              <button
                onClick={() => setCurrentPage("orders")}
                className="btn-secondary"
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="section-container">
          <div className="stats-grid">
            <div className="card-stats card-stats-blue">
              <div className="stats-icon">📦</div>
              <div className="stats-value stats-value-blue">{products.length}</div>
              <div className="stats-label">Products Available</div>
            </div>
            <div className="card-stats card-stats-purple">
              <div className="stats-icon">🛒</div>
              <div className="stats-value stats-value-purple">{cart.length}</div>
              <div className="stats-label">Items in Cart</div>
            </div>
            <div className="card-stats card-stats-pink">
              <div className="stats-icon">✨</div>
              <div className="stats-value stats-value-pink">24/7</div>
              <div className="stats-label">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-container">
          <div className="features-header">
            <h2 className="features-title">Why Shop With Us?</h2>
            <p className="features-subtitle">Experience shopping the way it should be</p>
          </div>
          <div className="features-grid">
            <div className="card-feature">
              <div className="feature-icon">🚀</div>
              <h3 className="feature-title">Fast Delivery</h3>
              <p className="feature-description">Get your orders delivered quickly and securely to your doorstep.</p>
            </div>
            <div className="card-feature">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Secure Payments</h3>
              <p className="feature-description">Shop with confidence using our encrypted payment system.</p>
            </div>
            <div className="card-feature">
              <div className="feature-icon">🎁</div>
              <h3 className="feature-title">Best Prices</h3>
              <p className="feature-description">Competitive pricing and exclusive deals on premium products.</p>
            </div>
            <div className="card-feature">
              <div className="feature-icon">💖</div>
              <h3 className="feature-title">Quality Guaranteed</h3>
              <p className="feature-description">Every product is carefully curated for the best quality.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Shopping?</h2>
          <p className="cta-description">
            Browse our collection and find exactly what you're looking for.
          </p>
          <button
            onClick={() => setCurrentPage("products")}
            className="btn-primary-lg"
          >
            Explore Products →
          </button>
        </div>
      </section>

      {/* Admin Quick Access */}
      {role === "admin" && (
        <section className="admin-quick-access">
          <div className="section-container">
            <div className="admin-quick-access-content">
              <div>
                <h3 className="admin-quick-access-title">Admin Dashboard</h3>
                <p className="admin-quick-access-description">Manage your store, products, and orders</p>
              </div>
              <button
                onClick={() => setCurrentPage("admin")}
                className="btn-amber"
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
