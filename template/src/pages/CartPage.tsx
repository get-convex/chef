import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";

interface CartPageProps {
  setCurrentPage: (page: string) => void;
}

export function CartPage({ setCurrentPage }: CartPageProps) {
  const cart = useQuery(api.storeCart.getCart) ?? [];
  const removeFromCart = useMutation(api.storeCart.removeFromCart);
  const updateCartItem = useMutation(api.storeCart.updateCartItem);
  const placeOrder = useMutation(api.storeOrders.placeOrder);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Fetch product details for each cart item
  const productQueries = cart.map((item) =>
    useQuery(api.storeProducts.getProduct, { id: item.productId }),
  );

  const cartWithProducts = cart.map((item, idx) => ({
    ...item,
    product: productQueries[idx],
  }));

  const total = cartWithProducts.reduce(
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0,
  );

  const handleRemove = async (id: string) => {
    try {
      await removeFromCart({ id: id as any });
      toast.success("Item removed from cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove item");
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    try {
      await updateCartItem({ id: id as any, quantity });
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const items = cartWithProducts.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.product?.price ?? 0,
      }));
      await placeOrder({ items, total });
      toast.success("Order placed successfully!");
      setCurrentPage("orders");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-xl p-16 border border-gray-100">
              <div className="text-8xl mb-6 animate-pulse">🛒</div>
              <h1 className="text-4xl font-bold mb-4 text-gray-900">Your Cart is Empty</h1>
              <p className="text-gray-600 mb-8 text-lg">
                Looks like you haven't added anything to your cart yet.
                Start exploring our amazing products!
              </p>
              <button
                onClick={() => setCurrentPage("home")}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Start Shopping
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600">Review your items before checkout</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartWithProducts.map((item) => (
              <div
                key={item._id}
                className="flex gap-6 p-6 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <img
                  src={
                    item.product?.image ||
                    "https://via.placeholder.com/120?text=Product"
                  }
                  alt={item.product?.title}
                  className="w-28 h-28 object-cover rounded-xl"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2 text-gray-900">{item.product?.title}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {item.product?.description}
                  </p>
                  <p className="font-bold text-2xl text-indigo-600">
                    ${item.product?.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col justify-between items-end">
                  <button
                    onClick={() => handleRemove(item._id)}
                    className="text-red-500 hover:text-red-700 font-medium text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item._id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-gray-700"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-bold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item._id, item.quantity + 1)
                      }
                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-bold text-gray-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 sticky top-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Order Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-semibold text-green-600">Free</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold text-gray-900">$0.00</span>
                </div>
                <hr className="my-4 border-gray-200" />
                <div className="flex justify-between text-2xl font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-indigo-600">${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 text-lg"
              >
                {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
              </button>
              <div className="mt-6 text-center">
                <button
                  onClick={() => setCurrentPage("home")}
                  className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                >
                  ← Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
