import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";

interface CartPageProps {
  setCurrentPage: (page: string) => void;
}

export function CartPage({ setCurrentPage }: CartPageProps) {
  const cart = useQuery(api.cart.getCart) ?? [];
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const placeOrder = useMutation(api.orders.placeOrder);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Fetch product details for each cart item
  const productQueries = cart.map((item) =>
    useQuery(api.products.getProduct, { id: item.productId }),
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
      <main className="container mx-auto p-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
          <p className="text-secondary mb-6">
            Add some products to your cart to get started!
          </p>
          <button
            onClick={() => setCurrentPage("home")}
            className="px-6 py-3 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cartWithProducts.map((item) => (
            <div
              key={item._id}
              className="flex gap-4 p-4 border rounded-lg bg-white"
            >
              <img
                src={
                  item.product?.image ||
                  "https://via.placeholder.com/100?text=Product"
                }
                alt={item.product?.title}
                className="w-24 h-24 object-cover rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.product?.title}</h3>
                <p className="text-secondary text-sm mb-2">
                  {item.product?.description}
                </p>
                <p className="font-bold text-primary">
                  ${item.product?.price.toFixed(2)}
                </p>
              </div>
              <div className="flex flex-col justify-between items-end">
                <button
                  onClick={() => handleRemove(item._id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleUpdateQuantity(item._id, item.quantity - 1)
                    }
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() =>
                      handleUpdateQuantity(item._id, item.quantity + 1)
                    }
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 p-6 rounded-lg h-fit border">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full px-6 py-3 bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
          </button>
        </div>
      </div>
    </main>
  );
}
