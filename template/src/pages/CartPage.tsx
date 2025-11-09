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
      <main className="page-main">
        <div className="page-content-lg">
          <div className="empty-state">
            <div className="card-empty">
              <div className="empty-state-icon-pulse">🛒</div>
              <h1 className="empty-state-title">Your Cart is Empty</h1>
              <p className="empty-state-description">
                Looks like you haven't added anything to your cart yet.
                Start exploring our amazing products!
              </p>
              <button
                onClick={() => setCurrentPage("home")}
                className="btn-primary"
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
    <main className="page-main">
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Shopping Cart</h1>
          <p className="page-subtitle">Review your items before checkout</p>
        </div>
        <div className="cart-grid">
          <div className="cart-items">
            {cartWithProducts.map((item) => (
              <div
                key={item._id}
                className="card-cart-item"
              >
                <img
                  src={
                    item.product?.image ||
                    "https://via.placeholder.com/120?text=Product"
                  }
                  alt={item.product?.title}
                  className="cart-item-image"
                />
                <div className="cart-item-info">
                  <h3 className="cart-item-title">{item.product?.title}</h3>
                  <p className="cart-item-description">
                    {item.product?.description}
                  </p>
                  <p className="cart-item-price">
                    ${item.product?.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col justify-between items-end">
                  <button
                    onClick={() => handleRemove(item._id)}
                    className="btn-remove"
                  >
                    Remove
                  </button>
                  <div className="cart-quantity-controls">
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item._id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                      className="btn-quantity"
                    >
                      -
                    </button>
                    <span className="cart-quantity-value">{item.quantity}</span>
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item._id, item.quantity + 1)
                      }
                      className="btn-quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            <div className="card-order-summary">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Order Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="order-summary-row">
                  <span className="order-summary-label">Subtotal</span>
                  <span className="order-summary-value">${total.toFixed(2)}</span>
                </div>
                <div className="order-summary-row">
                  <span className="order-summary-label">Shipping</span>
                  <span className="font-semibold text-green-600">Free</span>
                </div>
                <div className="order-summary-row">
                  <span className="order-summary-label">Tax</span>
                  <span className="order-summary-value">$0.00</span>
                </div>
                <hr className="my-4 border-gray-200" />
                <div className="order-summary-total">
                  <span className="order-summary-total-label">Total</span>
                  <span className="order-summary-total-value">${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="btn-checkout"
              >
                {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
              </button>
              <div className="mt-6 text-center">
                <button
                  onClick={() => setCurrentPage("home")}
                  className="btn-link"
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
