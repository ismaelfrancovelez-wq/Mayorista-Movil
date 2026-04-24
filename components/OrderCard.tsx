"use client";

type Props = {
  productId: string;
  children: React.ReactNode;
};

export default function OrderCard({ productId, children }: Props) {
  return (
    <div
      className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        window.location.href = `/explorar/${productId}`;
      }}
    >
      {children}
    </div>
  );
}