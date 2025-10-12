import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OrdersPage() {
  const orders = useQuery(api.orders.listOrdersForUser) ?? [];

  if (orders.length === 0) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">My Orders</h1>
          <p className="text-secondary">You haven't placed any orders yet.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>
      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order._id} className="border rounded-lg p-6 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-secondary">Order ID: {order._id}</p>
                <p className="text-sm text-secondary">
                  Placed: {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">
                  ${order.total.toFixed(2)}
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                    order.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : order.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Items:</h3>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    Product ID: {item.productId} (x{item.quantity})
                  </span>
                  <span>${item.priceAtPurchase.toFixed(2)} each</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
