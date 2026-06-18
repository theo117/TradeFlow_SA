import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legalBusiness } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Refund Policy | ${legalBusiness.productName}`
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund and cancellation policy"
      description="This policy explains how subscriptions, cancellations, failed payments, and pilot billing are handled."
    >
      <LegalSection title="1. Pilot and early-access billing">
        <p>
          Pilot businesses may be billed manually, discounted, or not billed while the product is being tested. Any pilot-specific agreement confirmed in writing takes priority over this general policy.
        </p>
      </LegalSection>

      <LegalSection title="2. Subscription billing">
        <p>
          If paid subscriptions are enabled, fees are charged in advance for the selected billing period. Access may be limited if payment fails, is reversed, or remains overdue.
        </p>
      </LegalSection>

      <LegalSection title="3. Cancellations">
        <p>
          You may request cancellation by contacting {legalBusiness.contactEmail}. Cancellation stops future billing but does not automatically refund the current billing period unless required by law or agreed in writing.
        </p>
      </LegalSection>

      <LegalSection title="4. Refunds">
        <p>
          Refunds are considered case by case for duplicate charges, billing errors, unavailable service, or other fair reasons. Approved refunds are returned through the original payment method where possible.
        </p>
      </LegalSection>

      <LegalSection title="5. Failed payments">
        <p>
          If a payment fails, your subscription may be marked past due. We may retry payment, request updated payment details, or restrict paid features until the account is settled.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Billing questions, cancellation requests, and refund requests can be sent to {legalBusiness.contactEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
