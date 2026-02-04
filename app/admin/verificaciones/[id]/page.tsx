// app/admin/verificaciones/[id]/page.tsx

import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";
import { notFound } from "next/navigation";
import VerificationActions from "../../../../components/admin/VerificationActions";

type VerificationDetail = {
  id: string;
  manufacturerId: string;
  legalName: string;
  cuit: string;
  taxType: string;
  fantasyName: string | null;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    formatted: string;
  };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  documents: {
    afip: {
      url: string;
      fileName: string;
      size: number;
    };
  };
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date;
  rejectionReason?: string;
};

async function getVerificationDetail(id: string): Promise<VerificationDetail | null> {
  const doc = await db.collection("verification_requests").doc(id).get();

  if (!doc.exists) return null;

  const data = doc.data()!;

  return {
    id: doc.id,
    manufacturerId: data.manufacturerId,
    legalName: data.legalName,
    cuit: data.cuit,
    taxType: data.taxType,
    fantasyName: data.fantasyName || null,
    address: data.address,
    contact: data.contact,
    documents: data.documents,
    status: data.status,
    submittedAt: data.submittedAt?.toDate() || new Date(),
    rejectionReason: data.rejectionReason,
  };
}

export default async function VerificationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const verification = await getVerificationDetail(params.id);

  if (!verification) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">
        
        {/* HEADER */}
        <div className="mb-8">
          <a 
            href="/admin/verificaciones"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← Volver a solicitudes
          </a>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {verification.legalName}
              </h1>
              <p className="text-gray-600">
                Solicitud de verificación
              </p>
            </div>

            {verification.status === 'pending' && (
              <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-semibold">
                ⏳ Pendiente
              </span>
            )}
            {verification.status === 'verified' && (
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
                ✓ Verificada
              </span>
            )}
            {verification.status === 'rejected' && (
              <span className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-semibold">
                ✕ Rechazada
              </span>
            )}
          </div>
        </div>

        {/* GRID DE INFORMACIÓN */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          
          {/* DATOS DE LA EMPRESA */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              🧾 Datos de la Empresa
            </h2>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Razón Social</div>
                <div className="font-semibold text-gray-900">{verification.legalName}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CUIT</div>
                <div className="font-mono text-gray-900">
                  {verification.cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3')}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo de Contribuyente</div>
                <div className="text-gray-900">
                  {verification.taxType === 'monotributo' && 'Monotributo'}
                  {verification.taxType === 'responsable_inscripto' && 'Responsable Inscripto'}
                  {verification.taxType === 'sociedad' && 'Sociedad (SRL/SA/SAS)'}
                </div>
              </div>

              {verification.fantasyName && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nombre de Fantasía</div>
                  <div className="text-gray-900">{verification.fantasyName}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fecha de Solicitud</div>
                <div className="text-gray-900">
                  {verification.submittedAt.toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* DIRECCIÓN */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              📍 Dirección
            </h2>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Calle</div>
                <div className="text-gray-900">{verification.address.street}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ciudad</div>
                  <div className="text-gray-900">{verification.address.city}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CP</div>
                  <div className="text-gray-900">{verification.address.postalCode}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Provincia</div>
                <div className="text-gray-900">{verification.address.province}</div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dirección Completa</div>
                <div className="text-sm text-gray-700">{verification.address.formatted}</div>
              </div>
            </div>
          </div>

          {/* RESPONSABLE */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              👤 Responsable de Contacto
            </h2>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nombre</div>
                <div className="text-gray-900">{verification.contact.name}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Teléfono</div>
                <div className="text-gray-900">
                  <a href={`tel:${verification.contact.phone}`} className="text-blue-600 hover:underline">
                    {verification.contact.phone}
                  </a>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</div>
                <div className="text-gray-900">
                  <a href={`mailto:${verification.contact.email}`} className="text-blue-600 hover:underline">
                    {verification.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* DOCUMENTACIÓN */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              📂 Documentación
            </h2>
            
            <div className="space-y-3">
              <div className="border-2 border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">Constancia AFIP</div>
                  <div className="text-xs text-gray-500">
                    {(verification.documents.afip.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {verification.documents.afip.fileName}
                </div>

                <a
                  href={verification.documents.afip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition w-full justify-center"
                >
                  <span>📄</span>
                  <span>Ver Documento</span>
                </a>

                <p className="text-xs text-gray-500 mt-2">
                  ⚠️ Verificá que el CUIT, razón social y estado activo coincidan
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES (solo si está pendiente) */}
        {verification.status === 'pending' && (
          <VerificationActions 
            verificationId={verification.id}
            manufacturerId={verification.manufacturerId}
            legalName={verification.legalName}
          />
        )}

        {/* MOTIVO DE RECHAZO (si fue rechazada) */}
        {verification.status === 'rejected' && verification.rejectionReason && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <h3 className="font-bold text-red-900 mb-2">Motivo de Rechazo</h3>
            <p className="text-red-700">{verification.rejectionReason}</p>
          </div>
        )}

      </div>
    </div>
  );
}