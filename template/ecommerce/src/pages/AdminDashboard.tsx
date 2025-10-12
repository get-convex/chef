import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminDashboard() {
  const role = useQuery(api.roles.getMyRole);
  const products = useQuery(api.products.listProducts) ?? [];
  const orders = useQuery(api.orders.listAllOrders) ?? [];
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [newProduct, setNewProduct] = useState({
    title: "",
    description: "",
    price: 0,
    image: "",
    stock: 10,
  });

  if (role !== "admin") {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-secondary">
            You don't have permission to access this page.
          </p>
        </div>
      </main>
    );
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct(newProduct);
      toast.success("Product created successfully!");
      setNewProduct({
        title: "",
        description: "",
        price: 0,
        image: "",
        stock: 10,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct({ id: id as any });
      toast.success("Product deleted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product");
    }
  };

  const handleUpdatePrice = async (id: string, newPrice: number) => {
    try {
      await updateProduct({ id: id as any, price: newPrice });
      toast.success("Price updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update price");
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    try {
      await updateOrderStatus({ id: id as any, status });
      toast.success("Order status updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("products")}
          className={`px-6 py-3 rounded font-semibold ${
            activeTab === "products"
              ? "bg-primary text-white"
              : "bg-gray-200 text-secondary hover:bg-gray-300"
          }`}
        >
          Manage Products
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-6 py-3 rounded font-semibold ${
            activeTab === "orders"
              ? "bg-primary text-white"
              : "bg-gray-200 text-secondary hover:bg-gray-300"
          }`}
        >
          View Orders
        </button>
      </div>

      {activeTab === "products" ? (
        <div>
          <div className="bg-white p-6 rounded-lg border mb-6">
            <h2 className="text-xl font-bold mb-4">Create New Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <input
                type="text"
                placeholder="Product Title"
                value={newProduct.title}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, title: e.target.value })
                }
                className="w-full px-4 py-2 border rounded"
                required
              />
              <textarea
                placeholder="Description"
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
                className="w-full px-4 py-2 border rounded"
                rows={3}
                required
              />
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="number"
                  placeholder="Price"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      price: parseFloat(e.target.value),
                    })
                  }
                  className="px-4 py-2 border rounded"
                  step="0.01"
                  required
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={newProduct.stock}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      stock: parseInt(e.target.value),
                    })
                  }
                  className="px-4 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={newProduct.image}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, image: e.target.value })
                  }
                  className="px-4 py-2 border rounded"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-white rounded hover:bg-primary-hover"
              >
                Create Product
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">All Products</h2>
            {products.map((product) => (
              <div
                key={product._id}
                className="flex justify-between items-center p-4 border rounded bg-white"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{product.title}</h3>
                  <p className="text-sm text-secondary">
                    {product.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">$</span>
                    <input
                      type="number"
                      value={product.price}
                      onChange={(e) =>
                        handleUpdatePrice(
                          product._id,
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(product._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">All Orders</h2>
          {orders.map((order) => (
            <div key={order._id} className="p-6 border rounded bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-secondary">
                    Order ID: {order._id}
                  </p>
                  <p className="text-sm text-secondary">
                    Customer: {order.userId}
                  </p>
                  <p className="text-sm text-secondary">
                    Date: {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">${order.total.toFixed(2)}</p>
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleUpdateOrderStatus(order._id, e.target.value)
                    }
                    className="mt-2 px-3 py-1 border rounded"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="shipped">Shipped</option>
                  </select>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Items:</h4>
                {order.items.map((item, idx) => (
                  <p key={idx} className="text-sm">
                    {item.productId} - Quantity: {item.quantity} - $
                    {item.priceAtPurchase.toFixed(2)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
