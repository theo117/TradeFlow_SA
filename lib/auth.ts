import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";

export async function requireUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  return user;
}

export async function requireBusiness() {
  const user = await requireUser();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, user.id))
    .limit(1);

  if (!business) {
    redirect("/register");
  }

  return {
    id: business.id,
    owner_id: business.ownerId,
    name: business.name,
    email: business.email,
    phone: business.phone,
    address: business.address,
    logo_url: business.logoUrl,
    payment_instructions: business.paymentInstructions,
    created_at: business.createdAt
  };
}
