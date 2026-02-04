// app/admin/verificaciones/page.tsx - VERSIÓN ACTUALIZADA

import { requireAdmin } from "../../../lib/auth/requireAdmin";
import { db } from "../../../lib/firebase-admin";
import Link from "next/link";

type VerificationRequest = {
  id: string;
  manufacturerId: string;
  legalName: string;
  cuit: string;
  taxType: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date;
};

async function getAllVerifications(): Promise<{
  pending: VerificationRequest[];
  verified: VerificationRequest[];
  rejected: VerificationRequest[];
}> {
  const [pendingSnap, verifiedSnap, rejectedSnap] = await Promise.all([
    db.collection("verification_requests").where("status", "==", "pending").orderBy("submittedAt", "desc").get(),
    db.collection("verification_requests").where("status", "==", "verified").orderBy("submittedAt", "desc").limit(10).get(),
    db.collection("verification_requests").where("status", "==", "rejected").orderBy("submittedAt", "desc").limit(10).get(),
  ]);

  const mapDocs = (snap: any) => snap.docs.map((doc: any) => ({
    id: doc.id,
    manufacturerId: doc.data().manufacturerId,
    legalName: doc.data().legalName,
    cuit: doc.data().cuit,
    taxType: doc.data().taxType,
    status: doc.data().status,
    submittedAt: doc.data().submittedAt?.toDate() || new Date(),
  }));

  return {
    pending: mapDocs(pendingSnap),
    verified: mapDocs(verifiedSnap),
    rejected: mapDocs(rejectedSnap),
  };
}

export default async function AdminVerificacionesPage() {
  await requireAdmin();

  const { pending, verified, rejected } = await getAllVerifications();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔐 Panel de Administración
          </h1>
          <p className="text-gray-600 mb-4">
            Gestión de verificaciones de empresas y productos intermediarios
          </p>
          
          {/* 🆕 NUEVO: BOTÓN PARA GESTIONAR PRODUCTOS INTERMEDIARIOS */}
          <div className="flex gap-3 mt-4">
            <Link
              href="/admin/productos-intermediarios"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-orange-700 transition shadow-md"
            >
              <svg 
                className="w-5 h-5"
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              <span>Gestionar Productos Intermediarios</span>
            </Link>
          </div>
        </div>

        {/* ESTADÍSTICAS */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 font-medium">Pendientes</p>
                <p className="text-3xl font-bold text-yellow-900">{pending.length}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Verificadas</p>
                <p className="text-3xl font-bold text-blue-900">{verified.length}</p>
              </div>
              <div className="text-4xl">✓</div>
            </div>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Rechazadas</p>
                <p className="text-3xl font-bold text-red-900">{rejected.length}</p>
              </div>
              <div className="text-4xl">✕</div>
            </div>
          </div>
        </div>

        {/* SOLICITUDES PENDIENTES */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            ⏳ Solicitudes Pendientes
            {pending.length > 0 && (
              <span className="bg-yellow-500 text-white text-sm px-2 py-1 rounded-full">
                {pending.length}
              </span>
            )}
          </h2>

          {pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✓</div>
              <p className="text-lg">No hay solicitudes pendientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Empresa</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">CUIT</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-900">{req.legalName}</div>
                        <div className="text-xs text-gray-500">ID: {req.manufacturerId.slice(0, 8)}...</div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {req.cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3')}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {req.taxType === 'monotributo' && 'Monotributo'}
                          {req.taxType === 'responsable_inscripto' && 'RI'}
                          {req.taxType === 'sociedad' && 'Sociedad'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {req.submittedAt.toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          href={`/admin/verificaciones/${req.id}`}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                        >
                          <span>Revisar</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HISTORIAL RECIENTE */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* VERIFICADAS */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 text-blue-900">
              ✓ Últimas Verificadas
            </h2>
            {verified.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay registros</p>
            ) : (
              <div className="space-y-3">
                {verified.slice(0, 5).map((req) => (
                  <div key={req.id} className="border-l-4 border-blue-500 pl-3 py-2">
                    <div className="font-medium text-sm">{req.legalName}</div>
                    <div className="text-xs text-gray-500">
                      {req.submittedAt.toLocaleDateString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECHAZADAS */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 text-red-900">
              ✕ Últimas Rechazadas
            </h2>
            {rejected.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay registros</p>
            ) : (
              <div className="space-y-3">
                {rejected.slice(0, 5).map((req) => (
                  <div key={req.id} className="border-l-4 border-red-500 pl-3 py-2">
                    <div className="font-medium text-sm">{req.legalName}</div>
                    <div className="text-xs text-gray-500">
                      {req.submittedAt.toLocaleDateString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}