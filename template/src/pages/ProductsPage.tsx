import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";

interface ProductsPageProps {
  setCurrentPage: (page: string) => void;
}

export function ProductsPage({ setCurrentPage }: ProductsPageProps) {
  const products = useQuery(api.storeProducts.listProducts) ?? [];
  const cart = useQuery(api.storeCart.getCart) ?? [];
  const addToCart = useMutation(api.storeCart.addToCart);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  // Get cart product IDs for quick lookup
  const cartProductIds = new Set(cart.map((item) => item.productId));

  // Filter products based on search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.title.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  const handleAddToCart = async (productId: string) => {
    if (addingToCart === productId) return;
    setAddingToCart(productId);
    try {
      await addToCart({ productId: productId as any, quantity: 1 });
      toast.success("Added to cart!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    } finally {
      setAddingToCart(null);
    }
  };

  if (products.length === 0) {
    return (
      <main className="page-main">
        <div className="page-content-lg">
          <div className="empty-state">
            <div className="card-empty">
              <div className="empty-state-icon">📦</div>
              <h1 className="empty-state-title">No Products Available</h1>
              <p className="empty-state-description">
                There are no products in the store yet. Check back later!
              </p>
              <button
                onClick={() => setCurrentPage("home")}
                className="btn-primary"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <div className="page-content">
        {/* Header Section */}
        <div className="page-header">
          <h1 className="page-title">Our Products</h1>
          <p className="page-subtitle mb-6">
            Discover our curated collection of premium products
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="search-clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-gray-500 mt-4">
            {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found
          </p>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="empty-state-no-results">
            <div className="empty-state-no-results-icon">🔍</div>
            <h2 className="empty-state-no-results-title">No products found</h2>
            <p className="empty-state-no-results-description">
              Try adjusting your search terms
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="btn-outline"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => {
              const isInCart = cartProductIds.has(product._id);
              const isOutOfStock = (product.stock ?? 0) === 0;
              
              return (
                <div
                  key={product._id}
                  className="card-product group"
                >
                  {/* Product Image */}
                  <div className="product-image-container">
                    <img
                      src={
                        product.image ||
                        "https://via.placeholder.com/400?text=Product"
                      }
                      alt={product.title}
                      className="product-image"
                    />
                    {isOutOfStock && (
                      <div className="product-out-of-stock">
                        <span className="product-out-of-stock-badge">
                          Out of Stock
                        </span>
                      </div>
                    )}
                    {isInCart && !isOutOfStock && (
                      <div className="product-badge">
                        <span>✓</span> In Cart
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="product-info">
                    <h3 className="product-title">
                      {product.title}
                    </h3>
                    <p className="product-description">
                      {product.description || "No description available"}
                    </p>
                    
                    {/* Price and Stock */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="product-price">
                          ${product.price.toFixed(2)}
                        </p>
                        {product.stock !== undefined && (
                          <p className="product-stock">
                            {product.stock > 0
                              ? `${product.stock} in stock`
                              : "Out of stock"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={() => handleAddToCart(product._id)}
                      disabled={isOutOfStock || addingToCart === product._id}
                      className={`btn-add-cart ${
                        isOutOfStock
                          ? "btn-add-cart-disabled"
                          : isInCart
                          ? "btn-add-cart-active"
                          : "btn-add-cart-default"
                      }`}
                    >
                      {addingToCart === product._id
                        ? "Adding..."
                        : isOutOfStock
                        ? "Out of Stock"
                        : isInCart
                        ? "✓ In Cart"
                        : "Add to Cart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
