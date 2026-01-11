"use client";

export default function Home() {
  const pagar = async () => {
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            title: "Pedido mayorista",
            quantity: 1,
            unit_price: 1500,
          },
        ],
      }),
    });

    const data = await res.json();

    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      alert("Error al crear el pago");
      console.error(data);
    }
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Pago de prueba Mercado Pago</h1>

      <button
        onClick={pagar}
        style={{
          padding: "12px 20px",
          fontSize: 18,
          cursor: "pointer",
          marginTop: 20,
        }}
      >
        Pagar $1500
      </button>
    </main>
  );
}