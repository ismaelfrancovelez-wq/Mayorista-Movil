import RevendedorSidebar from "../../../components/RevendedorSidebar";

export default function RevendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <RevendedorSidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}