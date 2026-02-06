// lib/env.ts
/**
 * Validador centralizado de variables de entorno
 */

type EnvVar = {
  key: string;
  required: boolean;
  description: string;
};

const ENV_VARS: EnvVar[] = [
  // Firebase Client
  {
    key: "NEXT_PUBLIC_FIREBASE_API_KEY",
    required: true,
    description: "Firebase API Key (cliente)",
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    required: true,
    description: "Firebase Auth Domain",
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    required: true,
    description: "Firebase Project ID",
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    required: true,
    description: "Firebase Storage Bucket",
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    required: true,
    description: "Firebase Messaging Sender ID",
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_APP_ID",
    required: true,
    description: "Firebase App ID",
  },

  // Firebase Admin
  {
    key: "FIREBASE_SERVICE_ACCOUNT",
    required: false,
    description: "Firebase Service Account JSON (solo producción)",
  },

  // Mercado Pago
  {
    key: "MERCADOPAGO_ACCESS_TOKEN",
    required: true,
    description: "Mercado Pago Access Token",
  },
  {
    key: "MERCADOPAGO_APP_ID",
    required: true,
    description: "Mercado Pago App ID (OAuth)",
  },
  {
    key: "MERCADOPAGO_CLIENT_SECRET",
    required: true,
    description: "Mercado Pago Client Secret (OAuth)",
  },
  {
    key: "MERCADOPAGO_PUBLIC_KEY",
    required: false,
    description: "Mercado Pago Public Key",
  },
  {
    key: "MERCADOPAGO_COLLECTOR_ID",
    required: false,
    description: "Mercado Pago Collector ID",
  },
  {
    key: "MERCADOPAGO_WEBHOOK_URL",
    required: false,
    description: "URL del webhook de Mercado Pago",
  },

  // Email - RESEND (reemplaza Gmail SMTP)
  {
    key: "RESEND_API_KEY",
    required: true,
    description: "Resend API Key",
  },
  {
    key: "EMAIL_FROM",
    required: true,
    description: "Email desde el cual se envían notificaciones (debe estar verificado en Resend)",
  },

  // Google Maps
  {
    key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    required: false,
    description: "Google Maps API Key",
  },

  // App
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: true,
    description: "URL base de la aplicación",
  },
];

/**
 * Valida que todas las variables de entorno requeridas estén presentes
 */
export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  ENV_VARS.forEach(({ key, required, description }) => {
    const value = process.env[key];

    if (!value || value.trim() === "") {
      if (required) {
        missing.push(`❌ ${key}: ${description}`);
      } else {
        warnings.push(`⚠️  ${key}: ${description} (opcional)`);
      }
    }
  });

  if (warnings.length > 0) {
    console.warn("\n⚠️  Variables de entorno opcionales faltantes:");
    warnings.forEach((w) => console.warn(`   ${w}`));
    console.warn("");
  }

  if (missing.length > 0) {
    console.error("\n❌ ERROR: Variables de entorno requeridas faltantes:\n");
    missing.forEach((m) => console.error(`   ${m}`));
    console.error("\n💡 Verifica las variables en Vercel\n");
    
    throw new Error("Faltan variables de entorno críticas");
  }

  console.log("✅ Todas las variables de entorno requeridas están presentes");
}

/**
 * Helpers seguros para obtener variables de entorno
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Variable de entorno ${key} no está configurada`);
  }
  
  return value;
}

export function getEnvOptional(key: string, defaultValue = ""): string {
  return process.env[key] || defaultValue;
}

/**
 * Variables de entorno tipadas y validadas
 */
export const env = {
  // Firebase Client
  firebase: {
    apiKey: () => getEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: () => getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: () => getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: () => getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: () => getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: () => getEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  },

  // Mercado Pago
  mercadopago: {
    accessToken: () => getEnv("MERCADOPAGO_ACCESS_TOKEN"),
    appId: () => getEnv("MERCADOPAGO_APP_ID"),
    clientSecret: () => getEnv("MERCADOPAGO_CLIENT_SECRET"),
    publicKey: () => getEnvOptional("MERCADOPAGO_PUBLIC_KEY"),
    collectorId: () => getEnvOptional("MERCADOPAGO_COLLECTOR_ID"),
    webhookUrl: () => getEnvOptional("MERCADOPAGO_WEBHOOK_URL"),
  },

  // Email - RESEND (reemplaza Gmail SMTP)
  email: {
    apiKey: () => getEnv("RESEND_API_KEY"),
    from: () => getEnv("EMAIL_FROM"),
  },

  // Google Maps
  googleMaps: {
    apiKey: () => getEnvOptional("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
  },

  // App
  app: {
    url: () => getEnv("NEXT_PUBLIC_APP_URL"),
    nodeEnv: () => getEnvOptional("NODE_ENV", "development"),
    isDevelopment: () => process.env.NODE_ENV === "development",
    isProduction: () => process.env.NODE_ENV === "production",
  },
};