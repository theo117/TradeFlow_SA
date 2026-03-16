"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations";

export async function login(formData: FormData) {
  const payload = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(payload);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const payload = registerSchema.parse({
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    password: formData.get("password")
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password
  });

  if (error || !data.user) {
    redirect(`/register?error=${encodeURIComponent(error?.message ?? "Unable to register")}`);
  }

  await supabase.from("businesses").insert({
    owner_id: data.user.id,
    name: payload.businessName
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
