import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OrdersPage() {
  const orders = useQuery(api.storeOrders.listOrdersForUser) ?? [];

  if (orders.length === 0) {
    return (
      <main className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-xl p-16 border border-gray-100">
              <div className="text-8xl mb-6">📦</div>
              <h1 className="text-4xl font-bold mb-4 text-gray-900">No Orders Yet</h1>
              <p className="text-gray-600 text-lg">
                You haven't placed any orders yet. Start shopping to see your order history here!
              </p>
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
          <h1 className="text-4xl font-bold mb-2 text-gray-900">My Orders</h1>
          <p className="text-gray-600">Track and manage your orders</p>
        </div>
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-8 border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-500">ORDER ID</span>
                    <span className="text-sm text-gray-600 font-mono bg-gray-50 px-3 py-1 rounded-lg">
                      {order._id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600 flex items-center gap-2">
                    <span className="text-2xl">📅</span>
                    <span className="font-medium">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-indigo-600 mb-2">
                    ${order.total.toFixed(2)}
                  </p>
                  <span
                    className={`inline-block px-4 py-2 rounded-xl text-sm font-bold ${
                      order.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {order.status === "pending" && "⌛ "}
                    {order.status === "paid" && "✅ "}
                    {order.status === "shipped" && "🚚 "}
                    {order.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-900">Order Items</h3>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 text-indigo-600 font-bold px-3 py-2 rounded-lg">
                          x{item.quantity}
                        </div>
                        <span className="text-gray-700 font-medium">Product ID: {item.productId.slice(-6)}</span>
                      </div>
                      <span className="font-bold text-gray-900">
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
