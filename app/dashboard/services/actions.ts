"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serviceSchema } from "@/lib/validations";

export async function createService(formData: FormData) {
  try {
    const business = await requireBusiness();
    const payload = serviceSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price")
    });

    const supabase = await createClient();
    const { error } = await supabase.from("services").insert({
      business_id: business.id,
      name: payload.name,
      description: payload.description || null,
      price: payload.price
    });

    if (error) {
      redirect(`/dashboard/services/new?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/dashboard/services");
    redirect("/dashboard/services?success=Service%20created");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/services/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
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

    const supabase = await createClient();
    const { error } = await supabase
      .from("services")
      .update({
        name: payload.name,
        description: payload.description || null,
        price: payload.price
      })
      .eq("business_id", business.id)
      .eq("id", serviceId);

    if (error) {
      redirect(`/dashboard/services/${serviceId}/edit?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/dashboard/services");
    redirect("/dashboard/services?success=Service%20updated");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/services/${serviceId}/edit?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    throw error;
  }
}

export async function deleteService(formData: FormData) {
  const business = await requireBusiness();
  const serviceId = String(formData.get("serviceId"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("business_id", business.id)
    .eq("id", serviceId);

  revalidatePath("/dashboard/services");
  if (error) {
    return {
      error: true,
      message: error.message
    };
  }
  return {
    error: false,
    message: "Service deleted"
  };
}
