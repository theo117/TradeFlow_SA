"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { serviceSchema } from "@/lib/validations";

export async function createService(formData: FormData) {
  try {
    const business = await requireBusiness();
    const payload = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price")
    });

    await db.insert(services).values({
      businessId: business.id,
      name: payload.name,
      description: payload.description || null,
      price: payload.price
    });

    revalidatePath("/dashboard/services");
    redirect("/dashboard/services?success=Service%20created");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/services/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    if (error instanceof Error) {
      redirect(`/dashboard/services/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function updateService(serviceId: string, formData: FormData) {
  try {
    const business = await requireBusiness();
    const payload = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price")
    });

    const [updatedService] = await db
      .update(services)
      .set({
        name: payload.name,
        description: payload.description || null,
        price: payload.price
      })
      .where(and(eq(services.businessId, business.id), eq(services.id, serviceId)))
      .returning({ id: services.id });

    if (!updatedService) {
      redirect(`/dashboard/services/${serviceId}/edit?error=Service%20not%20found`);
    }

    revalidatePath("/dashboard/services");
    redirect("/dashboard/services?success=Service%20updated");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/services/${serviceId}/edit?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    if (error instanceof Error) {
      redirect(`/dashboard/services/${serviceId}/edit?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function deleteService(formData: FormData) {
  const business = await requireBusiness();
  const serviceId = String(formData.get("serviceId"));

  try {
    const [deletedService] = await db
      .delete(services)
      .where(and(eq(services.businessId, business.id), eq(services.id, serviceId)))
      .returning({ id: services.id });

    revalidatePath("/dashboard/services");

    if (!deletedService) {
      return {
        error: true,
        message: "Service not found"
      };
    }

    return {
      error: false,
      message: "Service deleted"
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to delete service"
    };
  }
}
