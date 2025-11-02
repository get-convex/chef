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
      <main className="flex-1 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="container mx-auto px-8 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-xl p-16 border border-red-100">
              <div className="text-8xl mb-6">🚫</div>
              <h1 className="text-4xl font-bold mb-4 text-gray-900">Access Denied</h1>
              <p className="text-gray-600 text-lg">
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
    <main className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">👨‍💼</span>
            <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage your store, products, and orders</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-8 py-4 rounded-xl font-bold transition-all ${
              activeTab === "products"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            📦 Manage Products
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-8 py-4 rounded-xl font-bold transition-all ${
              activeTab === "orders"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            📋 View Orders
          </button>
        </div>

      {activeTab === "products" ? (
        <div>
          {/* Create Product Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <span>➕</span> Create New Product
            </h2>
            <form onSubmit={handleCreateProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input
                  type="text"
                  placeholder="Product Title"
                  value={newProduct.title}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, title: e.target.value })
                  }
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  required
                />
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Product Image</label>
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
                      className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors text-center text-gray-600 hover:text-indigo-600"
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
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                rows={3}
                required
              />
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price ($)</label>
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Quantity</label>
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={uploadingImage}
                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? "Uploading image..." : "Create Product"}
              </button>
            </form>
          </div>

          {/* Products List */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📦 All Products ({products.length})</h2>
            {products.map((product) => (
              <div
                key={product._id}
                className="flex justify-between items-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-900 mb-1">{product.title}</h3>
                  <p className="text-gray-600 text-sm">
                    {product.description}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Stock: {product.stock || 0} units</p>
                </div>
                <div className="flex items-center gap-6">
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
                      className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none font-bold text-gray-900"
                      step="0.01"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(product._id)}
                    className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 All Orders ({orders.length})</h2>
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
                  <p className="text-gray-600">
                    <span className="font-semibold">Customer:</span> {order.userId.slice(-8)}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-semibold">Date:</span> {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-indigo-600 mb-3">${order.total.toFixed(2)}</p>
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleUpdateOrderStatus(order._id, e.target.value)
                    }
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-gray-700"
                  >
                    <option value="pending">⌛ Pending</option>
                    <option value="paid">✅ Paid</option>
                    <option value="shipped">🚚 Shipped</option>
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-bold mb-4 text-gray-900 text-lg">Order Items</h4>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 text-indigo-600 font-bold px-3 py-2 rounded-lg">
                          x{item.quantity}
                        </div>
                        <span className="font-medium text-gray-700">{item.productId.slice(-8)}</span>
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
      )}
      </div>
    </main>
  );
}
