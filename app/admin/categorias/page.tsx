// app/admin/categorias/page.tsx
// Herramienta de auditoría y migración de categorías de productos.

import { requireAdmin } from "../../../lib/auth/requireAdmin";
import CategoryAuditClient from "./CategoryAuditClient";

export default async function CategoriasAdminPage() {
  await requireAdmin();
  return <CategoryAuditClient />;
}
