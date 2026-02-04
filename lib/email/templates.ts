// lib/email/templates.ts

import { formatSchedule, formatArgentinaDate, getTimeRemaining } from '../business-hours';
import type { WeekSchedule } from '../business-hours';

/**
 * Base HTML para emails
 */
function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }
    .section-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 15px;
      color: #1f2937;
    }
    .info-row {
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
    }
    .info-label {
      font-weight: 500;
      color: #6b7280;
    }
    .info-value {
      font-weight: 600;
      color: #111827;
    }
    .warning-box {
      background-color: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .warning-box strong {
      color: #92400e;
    }
    .deadline {
      background-color: #fee2e2;
      border: 2px solid #dc2626;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
    }
    .deadline-time {
      font-size: 24px;
      font-weight: bold;
      color: #dc2626;
      margin: 10px 0;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .retailer-item {
      background-color: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${content}
  </div>
</body>
</html>
  `;
}

/**
 * FABRICANTE - Pedido Directo
 */
export function manufacturerDirectOrderEmail(data: {
  productName: string;
  qty: number;
  retailerName: string;
  retailerAddress: string;
  retailerPhone?: string;
  shippingMode: string;
  orderId: string;
  dashboardLink: string;
}): string {
  const content = `
    <div class="header">
      <h1>🎉 Nuevo Pedido Directo</h1>
    </div>

    <p>¡Felicitaciones! Recibiste un nuevo pedido directo confirmado.</p>

    <div class="section">
      <div class="section-title">📦 Detalles del Pedido</div>
      <div class="info-row">
        <span class="info-label">Producto:</span>
        <span class="info-value">${data.productName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cantidad:</span>
        <span class="info-value">${data.qty} unidades</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tipo:</span>
        <span class="info-value">Compra directa</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">👤 Cliente</div>
      <div class="info-row">
        <span class="info-label">Nombre:</span>
        <span class="info-value">${data.retailerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Dirección:</span>
        <span class="info-value">${data.retailerAddress}</span>
      </div>
      ${data.retailerPhone ? `
      <div class="info-row">
        <span class="info-label">Teléfono:</span>
        <span class="info-value">${data.retailerPhone}</span>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">🚚 Envío</div>
      <p><strong>Modalidad:</strong> ${data.shippingMode === 'pickup' ? 'Retiro en fábrica' : 'Envío por fábrica'}</p>
      ${data.shippingMode === 'pickup' ? `
        <div class="warning-box">
          <strong>⏰ IMPORTANTE:</strong> El cliente tiene 48hs hábiles para retirar desde que realizó la compra.
        </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">⏰ Próximos Pasos</div>
      <ol>
        <li>Preparar ${data.qty} unidades</li>
        <li>${data.shippingMode === 'pickup' ? 'Tener la mercadería lista para retiro' : 'Coordinar envío con el cliente'}</li>
        <li>El pago ya está acreditado</li>
      </ol>
    </div>

    <div style="text-align: center;">
      <a href="${data.dashboardLink}/dashboard/fabricante/pedidos/${data.orderId}" class="button">
        Ver Pedido Completo
      </a>
    </div>

    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
    </div>
  `;

  return emailWrapper(content);
}

/**
 * FABRICANTE - Lote Fraccionado Cerrado (SIN GANANCIA)
 */
export function manufacturerLotClosedEmail(data: {
  productName: string;
  totalQty: number;
  retailers: Array<{
    name: string;
    qty: number;
    address: string;
    phone?: string;
  }>;
  lotType: string;
  factoryAddress: string;
  orderId: string;
  dashboardLink: string;
}): string {
  const isPickup = data.lotType.includes('pickup');

  const content = `
    <div class="header">
      <h1>✅ Lote Fraccionado Completado</h1>
    </div>

    <p>¡El lote fraccionado alcanzó el mínimo y está listo para despacho!</p>

    <div class="section">
      <div class="section-title">📦 Resumen del Lote</div>
      <div class="info-row">
        <span class="info-label">Producto:</span>
        <span class="info-value">${data.productName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Pedido Total:</span>
        <span class="info-value">${data.totalQty} unidades</span>
      </div>
      <div class="info-row">
        <span class="info-label">Origen:</span>
        <span class="info-value">Compra fraccionada</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📋 Distribución por Revendedor</div>
      ${data.retailers.map(r => `
        <div class="retailer-item">
          <div style="font-weight: bold; margin-bottom: 8px;">${r.name}</div>
          <div>• Cantidad: ${r.qty} unidades</div>
          <div>• Dirección: ${r.address}</div>
          ${r.phone ? `<div>• Teléfono: ${r.phone}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-title">🚚 Logística</div>
      ${isPickup ? `
        <p><strong>Modalidad:</strong> RETIRO EN FÁBRICA</p>
        <div class="warning-box">
          <strong>⏰ IMPORTANTE:</strong> Los revendedores tienen 48hs hábiles para retirar desde que realizaron la compra.
          <br><br>
          Asegurate de tener la mercadería preparada en tus horarios de atención.
        </div>
      ` : `
        <p><strong>Modalidad:</strong> ENVÍO POR PLATAFORMA</p>
        <ol>
          <li><strong>Preparar:</strong> ${data.totalQty} unidades separadas por revendedor</li>
          <li><strong>Punto de entrega:</strong> ${data.factoryAddress}</li>
          <li><strong>Coordinación:</strong> Te contactaremos para coordinar retiro</li>
        </ol>
      `}
    </div>

    <div class="section">
      <div class="section-title">⏰ Próximos Pasos</div>
      <ol>
        <li>Preparar ${data.totalQty} unidades</li>
        <li>Separar por revendedor (ver distribución arriba)</li>
        <li>${isPickup ? 'Tener lista para retiro en horarios de atención' : 'Esperar coordinación de logística'}</li>
      </ol>
    </div>

    <div style="text-align: center;">
      <a href="${data.dashboardLink}/dashboard/fabricante/pedidos/${data.orderId}" class="button">
        Ver Orden Completa
      </a>
    </div>

    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
    </div>
  `;

  return emailWrapper(content);
}

/**
 * REVENDEDOR - Compra con Retiro en Fábrica
 */
export function retailerPickupEmail(data: {
  productName: string;
  qty: number;
  subtotal: number;
  total: number;
  factoryBusinessName: string;
  factoryAddress: string;
  factorySchedule: WeekSchedule;
  factoryPhone?: string;
  factoryEmail?: string;
  pickupDeadline: Date;
  orderId: string;
  dashboardLink: string;
  isDirect: boolean;
}): string {
  const timeRemaining = getTimeRemaining(data.pickupDeadline);
  const formattedDeadline = formatArgentinaDate(data.pickupDeadline);
  const formattedSchedule = formatSchedule(data.factorySchedule);

  const content = `
    <div class="header">
      <h1>✅ Compra Confirmada - Retiro en Fábrica</h1>
    </div>

    <p>¡Tu pago fue aprobado exitosamente!</p>

    <div class="section">
      <div class="section-title">📦 Detalles de tu Pedido</div>
      <div class="info-row">
        <span class="info-label">Producto:</span>
        <span class="info-value">${data.productName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cantidad:</span>
        <span class="info-value">${data.qty} unidades</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tipo:</span>
        <span class="info-value">${data.isDirect ? 'Compra directa' : 'Compra fraccionada'}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">💰 Resumen de Pago</div>
      <div class="info-row">
        <span class="info-label">Subtotal producto:</span>
        <span class="info-value">$${data.subtotal.toLocaleString('es-AR')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Envío:</span>
        <span class="info-value">$0 (retiro en fábrica)</span>
      </div>
      <div class="info-row" style="border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 10px;">
        <span class="info-label"><strong>Total pagado:</strong></span>
        <span class="info-value"><strong>$${data.total.toLocaleString('es-AR')}</strong></span>
      </div>
    </div>

    <div class="deadline">
      <div style="font-size: 18px; font-weight: bold; color: #dc2626;">
        ⏰ PLAZO DE RETIRO - ¡MUY IMPORTANTE!
      </div>
      <div style="margin: 15px 0;">
        <strong>Tenés 48 HORAS HÁBILES para retirar</strong>
      </div>
      <div class="deadline-time">
        ${timeRemaining.formatted}
      </div>
      <div style="font-size: 14px; margin-top: 10px;">
        Vencimiento: ${formattedDeadline}
      </div>
      <div class="warning-box" style="margin-top: 15px;">
        <strong>❌ Pasado este plazo, se aplicarán sanciones en tus próximas compras.</strong>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📍 Dónde Retirar</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ${data.factoryBusinessName}
      </div>
      <div style="margin-bottom: 15px;">
        📍 ${data.factoryAddress}
      </div>
    </div>

    <div class="section">
      <div class="section-title">📅 Días y Horarios de Atención</div>
      <pre style="background-color: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">${formattedSchedule}</pre>
    </div>

    ${(data.factoryPhone || data.factoryEmail) ? `
    <div class="section">
      <div class="section-title">📞 Contacto</div>
      ${data.factoryPhone ? `<div>Teléfono: <strong>${data.factoryPhone}</strong></div>` : ''}
      ${data.factoryEmail ? `<div>Email: <strong>${data.factoryEmail}</strong></div>` : ''}
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">⏰ Próximos Pasos</div>
      <ol>
        <li>Coordiná tu visita dentro del plazo</li>
        <li>Llevá identificación</li>
        <li>Mencioná tu pedido <strong>#${data.orderId}</strong></li>
      </ol>
    </div>

    <div style="text-align: center;">
      <a href="${data.dashboardLink}/dashboard/pedidos-fraccionados" class="button">
        Ver Mi Pedido
      </a>
    </div>

    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
    </div>
  `;

  return emailWrapper(content);
}

/**
 * FABRICANTE - Nuevo Pedido Fraccionado (Notificación de Progreso)
 */
export function manufacturerFractionalProgressEmail(data: {
  productName: string;
  retailerName: string;
  qty: number;
  accumulatedQty: number;
  minimumOrder: number;
  percentage: number;
  remaining: number;
}): string {
  const content = `
    <div class="header">
      <h1>📊 Nuevo Pedido Fraccionado</h1>
    </div>

    <p>Se sumó un nuevo pedido fraccionado a tu producto.</p>

    <div class="section">
      <div class="section-title">📦 Producto</div>
      <div class="info-row">
        <span class="info-label">Producto:</span>
        <span class="info-value">${data.productName}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">➕ Nuevo Pedido Sumado</div>
      <div class="info-row">
        <span class="info-label">Revendedor:</span>
        <span class="info-value">${data.retailerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cantidad:</span>
        <span class="info-value">${data.qty} unidades</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📈 Progreso del Lote</div>
      <div class="info-row">
        <span class="info-label">Acumulado:</span>
        <span class="info-value">${data.accumulatedQty} / ${data.minimumOrder}</span>
      </div>
      <div style="margin: 15px 0;">
        <div style="background-color: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
          <div style="background-color: #2563eb; height: 100%; width: ${data.percentage}%; transition: width 0.3s;"></div>
        </div>
        <div style="text-align: center; margin-top: 5px; font-weight: bold;">
          ${data.percentage.toFixed(0)}%
        </div>
      </div>
      <div class="info-row">
        <span class="info-label">Faltan:</span>
        <span class="info-value">${data.remaining} unidades</span>
      </div>
      ${data.percentage >= 80 ? `
        <div class="warning-box" style="margin-top: 15px;">
          <strong>🎯 ¡Casi completo!</strong> Solo faltan ${data.remaining} unidades.
        </div>
      ` : ''}
    </div>

    <p style="text-align: center; color: #6b7280;">
      ℹ️ Te notificaremos cuando se complete el lote.
    </p>

    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
    </div>
  `;

  return emailWrapper(content);
}