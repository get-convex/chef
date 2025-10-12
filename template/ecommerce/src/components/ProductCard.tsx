import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

interface Product {
  _id: Id<"products">;
  title: string;
  description: string;
  price: number;
  image?: string;
  stock?: number;
}

interface ProductCardProps {
  product: Product;
  onViewDetails?: (productId: Id<"products">) => void;
}

export function ProductCard({ product, onViewDetails }: ProductCardProps) {
  const addToCart = useMutation(api.cart.addToCart);

  const handleAddToCart = async () => {
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      toast.success("Added to cart!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    }
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white">
      <img
        src={
          product.image || "https://via.placeholder.com/300x200?text=Product"
        }
        alt={product.title}
        className="h-48 w-full object-cover rounded mb-3"
      />
      <h3 className="font-semibold text-lg mb-2">{product.title}</h3>
      <p className="text-sm text-secondary mb-3 line-clamp-2">
        {product.description}
      </p>
      <div className="flex justify-between items-center">
        <span className="text-xl font-bold text-primary">
          ${product.price.toFixed(2)}
        </span>
        <div className="flex gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(product._id)}
              className="px-3 py-2 text-sm border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors"
            >
              View
            </button>
          )}
          <button
            onClick={handleAddToCart}
            className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </div>
      {product.stock !== undefined && product.stock < 10 && (
        <p className="text-xs text-red-500 mt-2">
          Only {product.stock} left in stock!
        </p>
      )}
    </div>
  );
}
