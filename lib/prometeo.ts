// lib/prometeo.ts
//
// Cliente para Prometeo Open Banking API.
// Documentación: https://docs.prometeoapi.com/
//
// Patrón de uso típico:
//   const session = await prometeoLogin();
//   try {
//     const accounts = await prometeoGetAccounts(session.key);
//     const movements = await prometeoGetMovements(session.key, accounts[0]);
//     // ... usar movements
//   } finally {
//     await prometeoLogout(session.key); // SIEMPRE cerrar sesión
//   }

const BASE_URL = process.env.PROMETEO_BASE_URL || "https://banking.sandbox.prometeoapi.com";
const API_KEY = process.env.PROMETEO_API_KEY || "";

if (!API_KEY) {
  console.warn("⚠️ PROMETEO_API_KEY no configurado");
}

// ============================================================
// TIPOS
// ============================================================

export interface PrometeoProvider {
  code: string;
  name: string | null;
  country: string;
}

export interface PrometeoAccount {
  number: string;
  name: string;
  currency: string;
  branch?: string;
  balance: number;
  id?: string;
}

export interface PrometeoMovement {
  id: number;
  reference: string;
  date: string; // formato ISO o "DD/MM/YYYY HH:mm" según banco
  detail: string;
  debit: number;   // si es egreso, viene acá
  credit: number;  // si es ingreso (lo que nos importa), viene acá
}

export type PrometeoLoginStatus =
  | "logged_in"
  | "wrong_credentials"
  | "missing_credentials"
  | "select_client"
  | "interaction_required"
  | "error";

export interface PrometeoLoginResult {
  status: PrometeoLoginStatus;
  key?: string;
  field?: string;       // si interaction_required, qué pide el banco
  context?: string;     // texto orientativo (ej: pregunta de seguridad)
  message?: string;     // si status="error"
}

// ============================================================
// ERROR PERSONALIZADO
// ============================================================

export class PrometeoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public prometeoStatus?: string
  ) {
    super(message);
    this.name = "PrometeoError";
  }
}

// ============================================================
// HELPER INTERNO: fetch con headers de Prometeo
// ============================================================

async function prometeoFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${BASE_URL}${path}`;

  const headers = new Headers(options.headers || {});
  headers.set("X-API-Key", API_KEY);
  headers.set("Accept", "application/json");

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    throw new PrometeoError(
      "Prometeo: API Key inválida o no autorizada",
      401
    );
  }

  if (res.status >= 500) {
    const text = await res.text().catch(() => "");
    throw new PrometeoError(
      `Prometeo: error del servidor (${res.status}). ${text.slice(0, 200)}`,
      res.status
    );
  }

  // Algunas respuestas 4xx vienen con JSON útil (ej: "wrong_credentials")
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new PrometeoError(
      `Prometeo: respuesta no es JSON válido (HTTP ${res.status})`,
      res.status
    );
  }

  return data;
}

// ============================================================
// 1. LISTAR PROVEEDORES
// GET /provider/
// ============================================================

export async function prometeoListProviders(
  countryFilter?: string
): Promise<PrometeoProvider[]> {
  const data = await prometeoFetch("/provider/", { method: "GET" });

  if (data.status !== "success" || !Array.isArray(data.providers)) {
    throw new PrometeoError(
      `Prometeo: respuesta inesperada de /provider/`,
      undefined,
      data.status
    );
  }

  let providers: PrometeoProvider[] = data.providers;

  if (countryFilter) {
    providers = providers.filter(
      (p) => p.country?.toUpperCase() === countryFilter.toUpperCase()
    );
  }

  return providers;
}

// ============================================================
// 2. LOGIN
// POST /login/
// ============================================================

export async function prometeoLogin(args?: {
  provider?: string;
  username?: string;
  password?: string;
  // Para segundo paso si hay interaction_required:
  interactiveKey?: string;
  interactiveField?: string;
  interactiveValue?: string;
}): Promise<PrometeoLoginResult> {
  const provider = args?.provider || process.env.PROMETEO_PROVIDER || "test";
  const username = args?.username || process.env.PROMETEO_USERNAME || "";
  const password = args?.password || process.env.PROMETEO_PASSWORD || "";

  if (!username || !password) {
    throw new PrometeoError(
      "Prometeo: faltan PROMETEO_USERNAME o PROMETEO_PASSWORD"
    );
  }

  const formData = new URLSearchParams();
  formData.append("provider", provider);
  formData.append("username", username);
  formData.append("password", password);

  // Si es segundo paso (interactivo), agregar el campo extra
  if (args?.interactiveField && args?.interactiveValue) {
    formData.append(args.interactiveField, args.interactiveValue);
  }

  // Si es segundo paso, la URL lleva ?key=
  const path = args?.interactiveKey
    ? `/login/?key=${encodeURIComponent(args.interactiveKey)}`
    : `/login/`;

  const data = await prometeoFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  return {
    status: data.status,
    key: data.key,
    field: data.field,
    context: data.context,
    message: data.message,
  };
}

// ============================================================
// 3. LISTAR CUENTAS
// GET /account/?key=...
// ============================================================

export async function prometeoGetAccounts(
  sessionKey: string
): Promise<PrometeoAccount[]> {
  const data = await prometeoFetch(
    `/account/?key=${encodeURIComponent(sessionKey)}`,
    { method: "GET" }
  );

  if (data.status !== "success" || !Array.isArray(data.accounts)) {
    throw new PrometeoError(
      `Prometeo: respuesta inesperada de /account/`,
      undefined,
      data.status
    );
  }

  return data.accounts;
}

// ============================================================
// 4. LISTAR MOVIMIENTOS
// GET /account/{number}/movement/?key=...&currency=...&date_start=...&date_end=...
// ============================================================

export async function prometeoGetMovements(args: {
  sessionKey: string;
  accountNumber: string;
  currency: string;
  /** Fecha desde (Date object). Se formatea a "DD/MM/YYYY". */
  dateStart: Date;
  /** Fecha hasta (Date object). Se formatea a "DD/MM/YYYY". */
  dateEnd: Date;
}): Promise<PrometeoMovement[]> {
  const dateStartStr = formatDateForPrometeo(args.dateStart);
  const dateEndStr = formatDateForPrometeo(args.dateEnd);

  const params = new URLSearchParams({
    key: args.sessionKey,
    currency: args.currency,
    date_start: dateStartStr,
    date_end: dateEndStr,
  });

  const path = `/account/${encodeURIComponent(args.accountNumber)}/movement/?${params.toString()}`;
  const data = await prometeoFetch(path, { method: "GET" });

  if (data.status !== "success" || !Array.isArray(data.movements)) {
    throw new PrometeoError(
      `Prometeo: respuesta inesperada de /movement/`,
      undefined,
      data.status
    );
  }

  return data.movements;
}

// ============================================================
// 5. LOGOUT
// GET /logout/?key=...
// ============================================================

export async function prometeoLogout(sessionKey: string): Promise<void> {
  try {
    await prometeoFetch(`/logout/?key=${encodeURIComponent(sessionKey)}`, {
      method: "GET",
    });
  } catch (err) {
    // No lanzamos: si el logout falla, no es crítico (la sesión expira sola)
    console.warn("⚠️ Prometeo: error en logout (no crítico):", err);
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatDateForPrometeo(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Wrapper que ejecuta un callback con una sesión de Prometeo,
 * garantizando logout al final (incluso si el callback falla).
 *
 * Es el patrón que tenés que usar SIEMPRE desde el resto del código.
 */
export async function withPrometeoSession<T>(
  callback: (sessionKey: string) => Promise<T>
): Promise<T> {
  const login = await prometeoLogin();

  if (login.status !== "logged_in" || !login.key) {
    throw new PrometeoError(
      `Prometeo: login falló con status="${login.status}"${login.message ? ` (${login.message})` : ""}`,
      undefined,
      login.status
    );
  }

  const sessionKey = login.key;

  try {
    return await callback(sessionKey);
  } finally {
    await prometeoLogout(sessionKey);
  }
}