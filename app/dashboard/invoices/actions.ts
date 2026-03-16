"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireBusiness } from "@/lib/auth";
import { getDefaultInvoiceDueDate } from "@/lib/invoices";
import { createClient } from "@/lib/supabase/server";
import { convertQuoteToInvoiceSchema, invoiceStatusSchema } from "@/lib/validations";

export async function convertQuoteToInvoice(formData: FormData) {
  const redirectTo = String(
    formData.get("redirectTo") ?? "/dashboard/quotes"
  );

  try {
    const payload = convertQuoteToInvoiceSchema.parse({
      quoteId: formData.get("quoteId"),
      dueDate: formData.get("dueDate") ?? getDefaultInvoiceDueDate()
    });

    const business = await requireBusiness();
    const supabase = await createClient();

    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("business_id", business.id)
      .eq("quote_id", payload.quoteId)
      .maybeSingle();

    if (existingInvoice) {
      redirect(
        `/dashboard/invoices/${existingInvoice.id}?success=Invoice%20already%20exists`
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(
        "id, customer_id, total, items:quote_items(service_id, quantity, price, subtotal, service:services(name, description))"
      )
      .eq("business_id", business.id)
      .eq("id", payload.quoteId)
      .single();

    if (quoteError || !quote) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          quoteError?.message ?? "Quote not found"
        )}`
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        business_id: business.id,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        status: "draft",
        total: quote.total,
        due_date: payload.dueDate
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          invoiceError?.message ?? "Unable to convert quote"
        )}`
      );
    }

    const { error: itemsError } = await supabase.from("invoice_items").insert(
      (quote.items ?? []).map((item) => ({
        invoice_id: invoice.id,
        service_id: item.service_id,
        description: item.service?.name ?? item.service?.description ?? "Service",
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal
      }))
    );

    if (itemsError) {
      await supabase
        .from("invoices")
        .delete()
        .eq("business_id", business.id)
        .eq("id", invoice.id);
      redirect(
        `${redirectTo}?error=${encodeURIComponent(itemsError.message)}`
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    revalidatePath(`/dashboard/quotes/${quote.id}`);
    revalidatePath("/dashboard/invoices");
    redirect(`/dashboard/invoices/${invoice.id}?success=Invoice%20created`);
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          error.issues[0]?.message ?? "Invalid invoice values"
        )}`
      );
    }

    throw error;
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  nextStatus: "draft" | "sent" | "paid" | "overdue"
) {
  const business = await requireBusiness();
  const supabase = await createClient();
  const status = invoiceStatusSchema.parse(nextStatus);

  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("business_id", business.id)
    .eq("id", invoiceId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);

  if (error) {
    return {
      error: true,
      message: error.message
    };
  }

  return {
    error: false,
    message:
      status === "paid"
        ? "Invoice marked as paid"
        : `Invoice updated to ${status}`
  };
}
