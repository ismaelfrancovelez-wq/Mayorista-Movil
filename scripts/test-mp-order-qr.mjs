// scripts/test-mp-order-qr.mjs
// Crea una orden QR de $100 para probar la integración.
// Uso: node scripts/test-mp-order-qr.mjs

import { randomUUID } from "crypto";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "APP_USR-8804826906978282-051113-beafd82f6b47c96d8292d68600120281-1313811766";
const POS_EXTERNAL_ID = "MMSTORE001POS001"; // primera caja

async function main() {
  if (MP_ACCESS_TOKEN === "PEGAR_TOKEN_ACA") {
    console.error("❌ Falta MP_ACCESS_TOKEN.");
    process.exit(1);
  }

  const idempotencyKey = randomUUID();
  const externalRef = `test-${Date.now()}`;

  console.log("→ Creando orden QR de prueba...");
  console.log(`   POS: ${POS_EXTERNAL_ID}`);
  console.log(`   external_reference: ${externalRef}`);
  console.log(`   idempotency_key: ${idempotencyKey}`);

  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      type: "qr",
      total_amount: "100.00",
      description: "Prueba MayoristaMovil",
      external_reference: externalRef,
      expiration_time: "PT15M",
      config: {
        qr: {
          external_pos_id: POS_EXTERNAL_ID,
          mode: "dynamic",
        },
      },
      transactions: {
        payments: [{ amount: "100.00" }],
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`\n❌ Error ${res.status}:`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`\n✓ Orden creada: ${data.id}`);
  console.log(`   Estado: ${data.status} / ${data.status_detail}`);
  console.log(`   Payment ID: ${data.transactions?.payments?.[0]?.id}`);
  console.log("\n--- Respuesta completa ---");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
