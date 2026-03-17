"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg"]);

export async function updateBusinessProfile(formData: FormData) {
  const business = await requireBusiness();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const whatsappPhoneNumberId = String(
    formData.get("whatsappPhoneNumberId") ?? ""
  ).trim();
  const whatsappBusinessAccountId = String(
    formData.get("whatsappBusinessAccountId") ?? ""
  ).trim();
  const vatNumber = String(formData.get("vatNumber") ?? "").trim();
  const registrationNumber = String(
    formData.get("registrationNumber") ?? ""
  ).trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  const bankAccountName = String(
    formData.get("bankAccountName") ?? ""
  ).trim();
  const bankAccountNumber = String(
    formData.get("bankAccountNumber") ?? ""
  ).trim();
  const bankBranchCode = String(formData.get("bankBranchCode") ?? "").trim();
  const paymentInstructions = String(
    formData.get("paymentInstructions") ?? ""
  ).trim();
  const logo = formData.get("logo");

  if (!name) {
    redirect("/dashboard/settings?error=Business%20name%20is%20required");
  }

  let logoUrl = business.logo_url;

  if (logo instanceof File && logo.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      redirect("/dashboard/settings?error=Blob%20storage%20is%20not%20configured");
    }

    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      redirect("/dashboard/settings?error=Logo%20must%20be%20a%20PNG%20or%20JPEG");
    }

    if (logo.size > MAX_LOGO_SIZE) {
      redirect("/dashboard/settings?error=Logo%20must%20be%20smaller%20than%202MB");
    }

    const extension = logo.type === "image/png" ? "png" : "jpg";
    const blob = await put(
      `business-logos/${business.id}.${extension}`,
      logo,
      {
        access: "public",
        addRandomSuffix: true
      }
    );

    logoUrl = blob.url;
  }

  await db
    .update(businesses)
    .set({
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      whatsappPhoneNumberId: whatsappPhoneNumberId || null,
      whatsappBusinessAccountId: whatsappBusinessAccountId || null,
      vatNumber: vatNumber || null,
      registrationNumber: registrationNumber || null,
      bankName: bankName || null,
      bankAccountName: bankAccountName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankBranchCode: bankBranchCode || null,
      paymentInstructions: paymentInstructions || null,
      logoUrl
    })
    .where(eq(businesses.id, business.id));

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/quotes");
  redirect("/dashboard/settings?success=Business%20profile%20updated");
}
