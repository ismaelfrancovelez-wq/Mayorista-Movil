// app/api/manufacturers/verification/submit/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    
    // 🧾 1️⃣ Datos de la empresa
    const legalName = formData.get('legalName') as string;
    const cuit = formData.get('cuit') as string;
    const taxType = formData.get('taxType') as string;
    const fantasyName = formData.get('fantasyName') as string;

    // 📍 2️⃣ Dirección
    const street = formData.get('street') as string;
    const city = formData.get('city') as string;
    const province = formData.get('province') as string;
    const postalCode = formData.get('postalCode') as string;
    const lat = parseFloat(formData.get('lat') as string);
    const lng = parseFloat(formData.get('lng') as string);

    // 👤 3️⃣ Responsable
    const contactName = formData.get('contactName') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const contactEmail = formData.get('contactEmail') as string;

    // 📂 5️⃣ Documentación
    const afipDoc = formData.get('afipDoc') as File;

    // ✅ Validaciones básicas
    if (!legalName || !cuit || !street || !city || !province || !postalCode) {
      return NextResponse.json(
        { error: "Datos de empresa incompletos" },
        { status: 400 }
      );
    }

    const cleanCuit = cuit.replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      return NextResponse.json(
        { error: "CUIT inválido" },
        { status: 400 }
      );
    }

    if (!contactName || !contactPhone || !contactEmail) {
      return NextResponse.json(
        { error: "Datos de contacto incompletos" },
        { status: 400 }
      );
    }

    if (!afipDoc) {
      return NextResponse.json(
        { error: "Falta la constancia de AFIP" },
        { status: 400 }
      );
    }

    if (afipDoc.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Archivo demasiado grande (máx 5MB)" },
        { status: 400 }
      );
    }

    // TODO: Subir archivo a Firebase Storage
    // const afipUrl = await uploadToStorage(afipDoc, userId);
    const afipUrl = `pending-upload/${userId}/afip-${Date.now()}.pdf`; // Placeholder

    // 💾 Crear solicitud completa
    const verificationRequest = {
      manufacturerId: userId,
      
      // Empresa
      legalName,
      cuit: cleanCuit,
      taxType,
      fantasyName: fantasyName || null,
      
      // Dirección
      address: {
        street,
        city,
        province,
        postalCode,
        lat,
        lng,
        formatted: `${street}, ${city}, ${province}, ${postalCode}`,
      },
      
      // Contacto
      contact: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
      },
      
      // Documentos
      documents: {
        afip: {
          url: afipUrl,
          fileName: afipDoc.name,
          size: afipDoc.size,
          uploadedAt: new Date(),
        },
      },
      
      // Estado
      status: 'pending',
      submittedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Guardar solicitud
    await db.collection('verification_requests').add(verificationRequest);

    // Actualizar estado en perfil del fabricante
    await db
      .collection('manufacturers')
      .doc(userId)
      .set(
        {
          verification: {
            status: 'pending',
            legalName,
            cuit: cleanCuit,
            taxType,
            fantasyName: fantasyName || null,
            street,
            city,
            province,
            postalCode,
            contactName,
            contactPhone,
            contactEmail,
            submittedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    // TODO: Notificar a admins
    console.log(`✅ Nueva solicitud de verificación: ${legalName} (${userId})`);

    return NextResponse.json({
      success: true,
      message: "Solicitud enviada correctamente",
    });

  } catch (error) {
    console.error("❌ Submit verification:", error);
    return NextResponse.json(
      { error: "Error al enviar solicitud" },
      { status: 500 }
    );
  }
}