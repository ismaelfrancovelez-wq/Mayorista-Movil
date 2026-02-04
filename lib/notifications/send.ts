// lib/notifications/send.ts

import { db } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendEmail } from '../email/client';
import {
  manufacturerDirectOrderEmail,
  manufacturerLotClosedEmail,
  manufacturerFractionalProgressEmail,
  retailerPickupEmail,
} from '../email/templates';
import type { WeekSchedule } from '../business-hours';

/**
 * Tipos de notificación
 */
export type NotificationType =
  | 'manufacturer_direct_order'
  | 'manufacturer_lot_closed'
  | 'manufacturer_fractional_progress'
  | 'retailer_direct_pickup'
  | 'retailer_fractional_pickup'
  | 'retailer_refund';

/**
 * Data base para notificaciones
 */
export interface NotificationData {
  type: NotificationType;
  recipientId: string;
  recipientEmail: string;
  recipientRole: 'manufacturer' | 'retailer';
  data: Record<string, any>;
}

/**
 * Guarda notificación en Firestore
 */
async function saveNotification(params: NotificationData) {
  await db.collection('notifications').add({
    ...params,
    status: 'pending',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Envía notificación completa (Firestore + Email)
 */
export async function sendNotification(params: NotificationData) {
  try {
    // 1️⃣ Guardar en Firestore (para historial/dashboard)
    await saveNotification(params);

    // 2️⃣ Determinar subject y template
    let subject = '';
    let html = '';

    switch (params.type) {
      case 'manufacturer_direct_order':
        subject = `🎉 Nuevo Pedido Directo - ${params.data.productName || 'Producto'}`;
        html = manufacturerDirectOrderEmail(params.data as any);
        break;

      case 'manufacturer_lot_closed':
        subject = `✅ Lote Fraccionado Completado - ${params.data.productName || 'Producto'}`;
        html = manufacturerLotClosedEmail(params.data as any);
        break;

      case 'manufacturer_fractional_progress':
        subject = `📊 Nuevo Pedido Fraccionado - ${params.data.productName || 'Producto'}`;
        html = manufacturerFractionalProgressEmail(params.data as any);
        break;

      case 'retailer_direct_pickup':
      case 'retailer_fractional_pickup':
        subject = `✅ Pedido Confirmado - Retiro en Fábrica`;
        html = retailerPickupEmail(params.data as any);
        break;

      default:
        console.warn(`⚠️ Tipo de notificación no implementado: ${params.type}`);
        return;
    }

    // 3️⃣ Enviar email
    const result = await sendEmail({
      to: params.recipientEmail,
      subject,
      html,
    });

    if (result.success) {
      console.log(`✅ Notificación enviada: ${params.type} → ${params.recipientEmail}`);
    } else {
      console.error(`❌ Error enviando email: ${params.type}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Error en sendNotification:', error);
    throw error;
  }
}

/**
 * Notificar pedido directo a fabricante
 */
export async function notifyManufacturerDirectOrder(params: {
  factoryId: string;
  factoryEmail: string;
  productName: string;
  qty: number;
  retailerName: string;
  retailerAddress: string;
  retailerPhone?: string;
  shippingMode: string;
  orderId: string;
}) {
  await sendNotification({
    type: 'manufacturer_direct_order',
    recipientId: params.factoryId,
    recipientEmail: params.factoryEmail,
    recipientRole: 'manufacturer',
    data: {
      productName: params.productName,
      qty: params.qty,
      retailerName: params.retailerName,
      retailerAddress: params.retailerAddress,
      retailerPhone: params.retailerPhone,
      shippingMode: params.shippingMode,
      orderId: params.orderId,
      dashboardLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  });
}

/**
 * Notificar lote cerrado a fabricante
 */
export async function notifyManufacturerLotClosed(params: {
  factoryId: string;
  factoryEmail: string;
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
}) {
  await sendNotification({
    type: 'manufacturer_lot_closed',
    recipientId: params.factoryId,
    recipientEmail: params.factoryEmail,
    recipientRole: 'manufacturer',
    data: {
      productName: params.productName,
      totalQty: params.totalQty,
      retailers: params.retailers,
      lotType: params.lotType,
      factoryAddress: params.factoryAddress,
      orderId: params.orderId,
      dashboardLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  });
}

/**
 * Notificar progreso de lote a fabricante
 */
export async function notifyManufacturerFractionalProgress(params: {
  factoryId: string;
  factoryEmail: string;
  productName: string;
  retailerName: string;
  qty: number;
  accumulatedQty: number;
  minimumOrder: number;
}) {
  const percentage = (params.accumulatedQty / params.minimumOrder) * 100;
  const remaining = params.minimumOrder - params.accumulatedQty;

  await sendNotification({
    type: 'manufacturer_fractional_progress',
    recipientId: params.factoryId,
    recipientEmail: params.factoryEmail,
    recipientRole: 'manufacturer',
    data: {
      productName: params.productName,
      retailerName: params.retailerName,
      qty: params.qty,
      accumulatedQty: params.accumulatedQty,
      minimumOrder: params.minimumOrder,
      percentage: Math.round(percentage),
      remaining: Math.max(0, remaining),
    },
  });
}

/**
 * Notificar retiro en fábrica a revendedor
 */
export async function notifyRetailerPickup(params: {
  retailerId: string;
  retailerEmail: string;
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
  isDirect: boolean;
}) {
  await sendNotification({
    type: params.isDirect ? 'retailer_direct_pickup' : 'retailer_fractional_pickup',
    recipientId: params.retailerId,
    recipientEmail: params.retailerEmail,
    recipientRole: 'retailer',
    data: {
      productName: params.productName,
      qty: params.qty,
      subtotal: params.subtotal,
      total: params.total,
      factoryBusinessName: params.factoryBusinessName,
      factoryAddress: params.factoryAddress,
      factorySchedule: params.factorySchedule,
      factoryPhone: params.factoryPhone,
      factoryEmail: params.factoryEmail,
      pickupDeadline: params.pickupDeadline,
      orderId: params.orderId,
      isDirect: params.isDirect,
      dashboardLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  });
}