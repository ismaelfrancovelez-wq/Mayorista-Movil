// scripts/test-prometeo.ts
// Run: npx tsx scripts/test-prometeo.ts

import {
  prometeoListProviders,
  prometeoGetAccounts,
  prometeoGetMovements,
  withPrometeoSession,
} from "../lib/prometeo";

async function main() {
  console.log("\n=== TEST 1: Listar proveedores AR ===");
  const providersAR = await prometeoListProviders("AR");
  console.log("Providers AR:", providersAR);

  console.log("\n=== TEST 2: Login + Accounts + Movements (provider=test) ===");
  await withPrometeoSession(async (sessionKey) => {
    console.log("✅ Login OK. Session key:", sessionKey.slice(0, 8) + "...");

    const accounts = await prometeoGetAccounts(sessionKey);
    console.log(`✅ ${accounts.length} cuentas encontradas:`);
    accounts.forEach((a) => {
      console.log(`   - ${a.number} (${a.currency}) - balance: ${a.balance}`);
    });

    if (accounts.length === 0) {
      console.log("⚠️ No hay cuentas para probar movimientos");
      return;
    }

    // Probar movimientos del último año (provider=test tiene datos viejos)
    const dateEnd = new Date();
    const dateStart = new Date();
    dateStart.setFullYear(dateStart.getFullYear() - 1);

    const acc = accounts[0];
    const movements = await prometeoGetMovements({
      sessionKey,
      accountNumber: acc.number,
      currency: acc.currency,
      dateStart,
      dateEnd,
    });

    console.log(`\n✅ ${movements.length} movimientos en el último año:`);
    movements.slice(0, 5).forEach((m) => {
      console.log(`   - ${m.date} | ${m.detail} | debit=${m.debit} credit=${m.credit}`);
    });
  });

  console.log("\n=== TODOS LOS TESTS PASARON ✅ ===\n");
}

main().catch((err) => {
  console.error("\n❌ TEST FALLÓ:", err);
  process.exit(1);
});