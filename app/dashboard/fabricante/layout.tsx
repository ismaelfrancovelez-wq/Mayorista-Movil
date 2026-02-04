import FabricanteSidebar from "../../../components/FabricanteSidebar";

export default function FabricanteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <FabricanteSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}