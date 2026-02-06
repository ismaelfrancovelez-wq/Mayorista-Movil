// app/api/test-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: "Mayorista Movil <onboarding@resend.dev>",
      to: "TU_EMAIL_PERSONAL@gmail.com",
      subject: "TEST RESEND OK",
      html: "<h1>Si llegó este mail, Resend funciona ✅</h1>",
    });

    console.log("RESEND RESULT:", result);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("RESEND ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err.message, full: err },
      { status: 500 }
    );
  }
}
