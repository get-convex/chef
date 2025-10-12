import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductCard } from "../components/ProductCard";
import type { Id } from "../../convex/_generated/dataModel";

interface HomePageProps {
  setCurrentPage: (page: string) => void;
  setSelectedProductId: (id: Id<"products"> | null) => void;
}

export function HomePage({
  setCurrentPage,
  setSelectedProductId,
}: HomePageProps) {
  const products = useQuery(api.products.listProducts) ?? [];

  const handleViewDetails = (productId: Id<"products">) => {
    setSelectedProductId(productId);
    setCurrentPage("product");
  };

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Welcome to Chef Store</h1>
        <p className="text-secondary">
          Discover amazing products at great prices!
        </p>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-secondary text-lg">
            No products available yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </main>
  );
}
