"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { requirePaidBusiness } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { customerSchema } from "@/lib/validations";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

export async function createCustomer(formData: FormData) {
  try {
    const business = await requirePaidBusiness();
    const payload = customerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      whatsappPhone: formData.get("whatsappPhone"),
      whatsappOptIn: formData.get("whatsappOptIn") === "on",
      address: formData.get("address")
    });

    const [customer] = await db.insert(customers).values({
      businessId: business.id,
      name: payload.name,
      email: payload.email || null,
      phone: payload.phone || null,
      whatsappPhone:
        payload.whatsappPhone || payload.phone
          ? normalizeWhatsappPhone(payload.whatsappPhone || payload.phone || "")
          : null,
      whatsappOptIn: payload.whatsappOptIn,
      address: payload.address || null
    }).returning({ id: customers.id, name: customers.name });

    await logActivityEvent({
      businessId: business.id,
      customerId: customer.id,
      type: "customer.created",
      description: `Customer ${customer.name} was created.`
    });

    revalidatePath("/dashboard/customers");
    redirect("/dashboard/customers?success=Customer%20created");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/customers/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    if (error instanceof Error) {
      redirect(`/dashboard/customers/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function updateCustomer(customerId: string, formData: FormData) {
  try {
    const business = await requirePaidBusiness();
    const payload = customerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      whatsappPhone: formData.get("whatsappPhone"),
      whatsappOptIn: formData.get("whatsappOptIn") === "on",
      address: formData.get("address")
    });

    const [updatedCustomer] = await db
      .update(customers)
      .set({
        name: payload.name,
        email: payload.email || null,
        phone: payload.phone || null,
        whatsappPhone:
          payload.whatsappPhone || payload.phone
            ? normalizeWhatsappPhone(payload.whatsappPhone || payload.phone || "")
            : null,
        whatsappOptIn: payload.whatsappOptIn,
        address: payload.address || null
      })
      .where(
        and(eq(customers.businessId, business.id), eq(customers.id, customerId))
      )
      .returning({ id: customers.id, name: customers.name });

    if (!updatedCustomer) {
      redirect(`/dashboard/customers/${customerId}/edit?error=Customer%20not%20found`);
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: updatedCustomer.id,
      type: "customer.updated",
      description: `Customer ${updatedCustomer.name} was updated.`
    });

    revalidatePath("/dashboard/customers");
    redirect("/dashboard/customers?success=Customer%20updated");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/customers/${customerId}/edit?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    if (error instanceof Error) {
      redirect(`/dashboard/customers/${customerId}/edit?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function deleteCustomer(formData: FormData) {
  const business = await requirePaidBusiness();
  const customerId = String(formData.get("customerId"));

  try {
    const [deletedCustomer] = await db
      .delete(customers)
      .where(
        and(eq(customers.businessId, business.id), eq(customers.id, customerId))
      )
      .returning({ id: customers.id });

    revalidatePath("/dashboard/customers");

    if (!deletedCustomer) {
      return {
        error: true,
        message: "Customer not found"
      };
    }

    return {
      error: false,
      message: "Customer deleted"
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to delete customer"
    };
  }
}
