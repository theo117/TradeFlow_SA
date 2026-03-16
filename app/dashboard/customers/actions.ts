"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validations";

export async function createCustomer(formData: FormData) {
  try {
    const business = await requireBusiness();
    const payload = customerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address")
    });

    const supabase = await createClient();
    const { error } = await supabase.from("customers").insert({
      business_id: business.id,
      name: payload.name,
      email: payload.email || null,
      phone: payload.phone || null,
      address: payload.address || null
    });

    if (error) {
      redirect(`/dashboard/customers/new?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/dashboard/customers");
    redirect("/dashboard/customers?success=Customer%20created");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/customers/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    throw error;
  }
}

export async function updateCustomer(customerId: string, formData: FormData) {
  try {
    const business = await requireBusiness();
    const payload = customerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address")
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        name: payload.name,
        email: payload.email || null,
        phone: payload.phone || null,
        address: payload.address || null
      })
      .eq("business_id", business.id)
      .eq("id", customerId);

    if (error) {
      redirect(`/dashboard/customers/${customerId}/edit?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/dashboard/customers");
    redirect("/dashboard/customers?success=Customer%20updated");
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/customers/${customerId}/edit?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    throw error;
  }
}

export async function deleteCustomer(formData: FormData) {
  const business = await requireBusiness();
  const customerId = String(formData.get("customerId"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("business_id", business.id)
    .eq("id", customerId);

  revalidatePath("/dashboard/customers");
  if (error) {
    return {
      error: true,
      message: error.message
    };
  }
  return {
    error: false,
    message: "Customer deleted"
  };
}
