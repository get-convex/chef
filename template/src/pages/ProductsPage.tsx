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
      <main className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-xl p-16 border border-gray-100">
              <div className="text-8xl mb-6">📦</div>
              <h1 className="text-4xl font-bold mb-4 text-gray-900">No Products Available</h1>
              <p className="text-gray-600 mb-8 text-lg">
                There are no products in the store yet. Check back later!
              </p>
              <button
                onClick={() => setCurrentPage("home")}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
    <main className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-8 py-12">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Our Products</h1>
          <p className="text-gray-600 mb-6">
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
                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          <div className="bg-white rounded-2xl shadow-sm p-16 border border-gray-100 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900">No products found</h2>
            <p className="text-gray-600 mb-6">
              Try adjusting your search terms
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isInCart = cartProductIds.has(product._id);
              const isOutOfStock = (product.stock ?? 0) === 0;
              
              return (
                <div
                  key={product._id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border border-gray-100 overflow-hidden group"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
                    <img
                      src={
                        product.image ||
                        "https://via.placeholder.com/400?text=Product"
                      }
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-lg">
                          Out of Stock
                        </span>
                      </div>
                    )}
                    {isInCart && !isOutOfStock && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                        <span>✓</span> In Cart
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <h3 className="font-bold text-xl mb-2 text-gray-900 line-clamp-2">
                      {product.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3 min-h-[60px]">
                      {product.description || "No description available"}
                    </p>
                    
                    {/* Price and Stock */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-2xl text-indigo-600">
                          ${product.price.toFixed(2)}
                        </p>
                        {product.stock !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
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
                      className={`w-full px-6 py-3 rounded-xl font-semibold transition-all ${
                        isOutOfStock
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : isInCart
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
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

