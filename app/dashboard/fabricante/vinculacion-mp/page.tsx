'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 🔧 Componente interno que usa useSearchParams
function VinculacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpEmail, setMpEmail] = useState('');
  const [error, setError] = useState('');

  // Verificar si ya está vinculado
  useEffect(() => {
    checkConnection();
  }, []);

  // Procesar resultado del callback de MP
  useEffect(() => {
    if (!searchParams) return;
    
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    // ✅ Nuevo flujo: el callback ya procesó todo server-side, solo refrescar estado
    if (success === 'true') {
      checkConnection();
      router.replace('/dashboard/fabricante/vinculacion-mp');
      return;
    }

    // ✅ Mostrar error si vino del callback
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_params: 'Faltan parámetros en la respuesta de Mercado Pago.',
        invalid_state: 'Error de seguridad en la solicitud. Intentá nuevamente.',
        session_expired: 'La sesión expiró. Iniciá el proceso de vinculación nuevamente.',
        token_error: 'Error al obtener el token de Mercado Pago. Intentá nuevamente.',
        callback_error: 'Error procesando la respuesta de Mercado Pago.',
      };
      setError(errorMessages[errorParam] || `Error: ${errorParam}`);
      router.replace('/dashboard/fabricante/vinculacion-mp');
      return;
    }

    // Flujo legacy: por si llega con code y state (compatibilidad)
    if (code && state) {
      processAuthorization(code);
    }
  }, [searchParams]);

  async function checkConnection() {
    try {
      const res = await fetch('/api/manufacturers/mp-status');
      if (res.ok) {
        const data = await res.json();
        setMpConnected(data.connected);
        setMpEmail(data.email || '');
      }
    } catch (error) {
      console.error('Error verificando conexión MP:', error);
    }
  }

  async function processAuthorization(code: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/manufacturers/mp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al vincular cuenta');
      }

      const data = await res.json();
      setMpConnected(true);
      setMpEmail(data.email || '');

      // Limpiar URL
      router.replace('/dashboard/fabricante/vinculacion-mp');
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Error al vincular tu cuenta de Mercado Pago');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/manufacturers/mp-auth-url');
      
      if (!res.ok) {
        throw new Error('Error al generar URL de autorización');
      }
      
      const data = await res.json();

      if (data.authUrl) {
        // Redirigir a Mercado Pago
        window.location.href = data.authUrl;
      } else {
        throw new Error('No se pudo generar la URL de autorización');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Error al iniciar vinculación');
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Seguro que deseas desvincular tu cuenta de Mercado Pago?')) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/manufacturers/mp-disconnect', {
        method: 'POST',
      });

      if (res.ok) {
        setMpConnected(false);
        setMpEmail('');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al desvincular cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button 
        onClick={() => router.back()} 
        className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-semibold mb-6">
        Vinculación de Mercado Pago
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">❌ {error}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-lg mb-3">
          ℹ️ ¿Por qué vincular tu cuenta?
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>• <strong>Recibís pagos directamente</strong> en tu cuenta de Mercado Pago</li>
          <li>• <strong>Sin intermediarios</strong> - El dinero va directo a vos</li>
          <li>• <strong>Seguridad garantizada</strong> por Mercado Pago</li>
          <li>• <strong>Retiros cuando quieras</strong> a tu banco</li>
        </ul>
      </div>

      {!mpConnected ? (
        <div className="bg-white rounded-xl shadow p-8">
          <h2 className="font-semibold text-xl mb-4">
            Vincular Cuenta de Mercado Pago
          </h2>

          <p className="text-gray-600 mb-6">
            Al hacer clic en &quot;Vincular cuenta&quot;, serás redirigido a Mercado Pago
            para autorizar que recibas pagos en tu cuenta.
          </p>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirigiendo...' : 'Vincular cuenta de Mercado Pago'}
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Es necesario tener una cuenta de Mercado Pago.
            Si no tenés una, podés crearla gratis en mercadopago.com.ar
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-xl mb-2">
                ✅ Cuenta Vinculada
              </h2>
              {mpEmail && (
                <p className="text-gray-600">
                  {mpEmail}
                </p>
              )}
            </div>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              Activa
            </span>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-green-800">
              <strong>✓ Todo listo!</strong> Ya podés recibir pagos directamente en tu cuenta de Mercado Pago.
            </p>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full border-2 border-red-500 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-50 transition disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Desvincular cuenta'}
          </button>
        </div>
      )}
    </div>
  );
}

// 🔧 Componente principal con Suspense
export default function VinculacionMPPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center text-gray-500">Cargando...</div>
      </div>
    }>
      <VinculacionContent />
    </Suspense>
  );
}