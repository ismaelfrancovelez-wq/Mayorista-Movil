import BackButton from "../../../../components/BackButton";

export default function PedidosFabricantePage() {
  return (
    <div>
      <BackButton className="mb-4" />
      
      <h1 className="text-2xl font-semibold mb-6">
        Pedidos de tus productos
      </h1>

      <p className="text-gray-600">
        No tenés pedidos todavía.
      </p>
    </div>
  );
}