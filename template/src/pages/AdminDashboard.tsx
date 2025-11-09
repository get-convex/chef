import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminDashboard() {
  const role = useQuery(api.storeRoles.getMyRole);
  const products = useQuery(api.storeProducts.listProducts) ?? [];
  const orders = useQuery(api.storeOrders.listAllOrders) ?? [];
  const createProduct = useMutation(api.storeProducts.createProduct);
  const updateProduct = useMutation(api.storeProducts.updateProduct);
  const deleteProduct = useMutation(api.storeProducts.deleteProduct);
  const updateOrderStatus = useMutation(api.storeOrders.updateOrderStatus);
  const generateUploadUrl = useMutation(api.storeProducts.generateUploadUrl);

  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [newProduct, setNewProduct] = useState({
    title: "",
    description: "",
    price: 0,
    image: "",
    stock: 10,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  if (role !== "admin") {
    return (
      <main className="admin-access-denied">
        <div className="page-content-lg">
          <div className="empty-state">
            <div className="admin-access-denied-card">
              <div className="empty-state-icon">🚫</div>
              <h1 className="empty-state-title">Access Denied</h1>
              <p className="empty-state-description">
                You don't have permission to access the admin dashboard.
                This area is restricted to administrators only.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setSelectedFile(file);
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewProduct({ ...newProduct, image: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let imageValue = newProduct.image;
      
      // If a file is selected, upload it first
      if (selectedFile) {
        setUploadingImage(true);
        try {
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": selectedFile.type },
            body: selectedFile,
          });
          const json = await result.json();
          if (!result.ok) {
            throw new Error(`Upload failed: ${JSON.stringify(json)}`);
          }
          const { storageId } = json;
          imageValue = storageId;
          setSelectedFile(null);
        } catch (error: any) {
          toast.error("Failed to upload image: " + (error.message || "Unknown error"));
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      await createProduct({
        ...newProduct,
        image: imageValue || undefined,
      });
      toast.success("Product created successfully!");
      setNewProduct({
        title: "",
        description: "",
        price: 0,
        image: "",
        stock: 10,
      });
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById("product-image-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
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
    <main className="page-main">
      <div className="page-content">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">👨‍💼</span>
            <h1 className="page-title">Admin Dashboard</h1>
          </div>
          <p className="page-subtitle">Manage your store, products, and orders</p>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button
            onClick={() => setActiveTab("products")}
            className={`btn-tab ${
              activeTab === "products"
                ? "btn-tab-active"
                : "btn-tab-inactive"
            }`}
          >
            📦 Manage Products
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`btn-tab ${
              activeTab === "orders"
                ? "btn-tab-active"
                : "btn-tab-inactive"
            }`}
          >
            📋 View Orders
          </button>
        </div>

      {activeTab === "products" ? (
        <div>
          {/* Create Product Form */}
          <div className="card-admin mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <span>➕</span> Create New Product
            </h2>
            <form onSubmit={handleCreateProduct} className="space-y-6">
              <div className="admin-form-grid">
                <input
                  type="text"
                  placeholder="Product Title"
                  value={newProduct.title}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, title: e.target.value })
                  }
                  className="form-input"
                  required
                />
                <div className="space-y-2">
                  <label className="form-label">Product Image</label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="product-image-upload"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="form-file-upload"
                    >
                      {selectedFile ? selectedFile.name : "📷 Upload Image"}
                    </label>
                    <input
                      type="text"
                      placeholder="Or paste image URL"
                      value={selectedFile ? "" : newProduct.image}
                      onChange={(e) => {
                        if (!selectedFile) {
                          setNewProduct({ ...newProduct, image: e.target.value });
                        }
                      }}
                      disabled={!!selectedFile}
                      className="form-input form-input-disabled flex-1"
                    />
                  </div>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setNewProduct({ ...newProduct, image: "" });
                        const fileInput = document.getElementById("product-image-upload") as HTMLInputElement;
                        if (fileInput) fileInput.value = "";
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove file
                    </button>
                  )}
                </div>
              </div>
              <textarea
                placeholder="Product Description"
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
                className="form-textarea"
                rows={3}
                required
              />
              <div className="admin-form-grid-2">
                <div>
                  <label className="form-label">Price ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={isNaN(newProduct.price) ? '' : newProduct.price}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setNewProduct({
                        ...newProduct,
                        price: isNaN(value) ? 0 : value,
                      });
                    }}
                    className="form-input w-full"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={isNaN(newProduct.stock) ? '' : newProduct.stock}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setNewProduct({
                        ...newProduct,
                        stock: isNaN(value) ? 0 : value,
                      });
                    }}
                    className="form-input w-full"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={uploadingImage}
                className="btn-primary w-full"
              >
                {uploadingImage ? "Uploading image..." : "Create Product"}
              </button>
            </form>
          </div>

          {/* Products List */}
          <div className="admin-product-list">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📦 All Products ({products.length})</h2>
            {products.map((product) => (
              <div
                key={product._id}
                className="card-product-admin"
              >
                <div className="admin-product-item">
                  <h3 className="admin-product-title">{product.title}</h3>
                  <p className="admin-product-description">
                    {product.description}
                  </p>
                  <p className="admin-product-stock">Stock: {product.stock || 0} units</p>
                </div>
                <div className="admin-product-actions">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-700">$</span>
                    <input
                      type="number"
                      value={isNaN(product.price) ? '' : product.price}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value)) {
                          handleUpdatePrice(product._id, value);
                        }
                      }}
                      className="admin-price-input"
                      step="0.01"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(product._id)}
                    className="btn-danger"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="orders-list">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 All Orders ({orders.length})</h2>
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
                  <p className="admin-order-customer">
                    <span className="admin-order-customer-label">Customer:</span> {order.userId.slice(-8)}
                  </p>
                  <p className="admin-order-customer">
                    <span className="admin-order-customer-label">Date:</span> {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="order-total">${order.total.toFixed(2)}</p>
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleUpdateOrderStatus(order._id, e.target.value)
                    }
                    className="form-select"
                  >
                    <option value="pending">⌛ Pending</option>
                    <option value="paid">✅ Paid</option>
                    <option value="shipped">🚚 Shipped</option>
                  </select>
                </div>
              </div>
              <div className="order-items-container">
                <h4 className="order-items-title">Order Items</h4>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <div className="flex items-center gap-3">
                        <div className="order-item-quantity">
                          x{item.quantity}
                        </div>
                        <span className="order-item-product">{item.productId.slice(-8)}</span>
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
      )}
      </div>
    </main>
  );
}
