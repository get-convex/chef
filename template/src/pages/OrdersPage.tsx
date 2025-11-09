import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OrdersPage() {
  const orders = useQuery(api.storeOrders.listOrdersForUser) ?? [];

  if (orders.length === 0) {
    return (
      <main className="page-main">
        <div className="page-content-lg">
          <div className="empty-state">
            <div className="card-empty">
              <div className="empty-state-icon">📦</div>
              <h1 className="empty-state-title">No Orders Yet</h1>
              <p className="empty-state-description">
                You haven't placed any orders yet. Start shopping to see your order history here!
              </p>
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
          <h1 className="page-title">My Orders</h1>
          <p className="page-subtitle">Track and manage your orders</p>
        </div>
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order._id} className="card-order">
              <div className="order-header">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="order-id-label">ORDER ID</span>
                    <span className="order-id-value">
                      {order._id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <p className="order-date">
                    <span className="order-date-icon">📅</span>
                    <span className="order-date-text">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="order-total">
                    ${order.total.toFixed(2)}
                  </p>
                  <span
                    className={`order-status ${
                      order.status === "pending"
                        ? "order-status-pending"
                        : order.status === "paid"
                          ? "order-status-paid"
                          : "order-status-shipped"
                    }`}
                  >
                    {order.status === "pending" && "⌛ "}
                    {order.status === "paid" && "✅ "}
                    {order.status === "shipped" && "🚚 "}
                    {order.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="order-items-container">
                <h3 className="order-items-title">Order Items</h3>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <div className="flex items-center gap-3">
                        <div className="order-item-quantity">
                          x{item.quantity}
                        </div>
                        <span className="order-item-product">Product ID: {item.productId.slice(-6)}</span>
                      </div>
                      <span className="order-item-price">
                        ${item.priceAtPurchase.toFixed(2)} each
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
