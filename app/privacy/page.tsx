import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legalBusiness } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy | ${legalBusiness.productName}`
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      description="This policy explains how TradeFlow SA handles personal information in a POPIA-conscious way for South African users."
    >
      <LegalSection title="1. Personal information we process">
        <p>
          We process account details, business profile details, customer contact details, quote and invoice data, billing records, support messages, audit logs, and technical information such as IP addresses and device/browser metadata.
        </p>
      </LegalSection>

      <LegalSection title="2. Why we process it">
        <p>
          We process personal information to provide the service, authenticate users, send account emails, generate business documents, support billing, prevent misuse, troubleshoot errors, and comply with legal obligations.
        </p>
      </LegalSection>

      <LegalSection title="3. POPIA roles">
        <p>
          For your business customer records, your business is usually the responsible party and {legalBusiness.productName} acts as an operator that processes information on your instructions.
        </p>
        <p>
          For account, billing, security, support, and platform analytics data, {legalBusiness.productName} may act as the responsible party.
        </p>
      </LegalSection>

      <LegalSection title="4. Service providers">
        <p>
          We use service providers for hosting, database storage, email delivery, file storage, payment processing, and messaging integrations. These providers may process information only to help us operate the service.
        </p>
      </LegalSection>

      <LegalSection title="5. Security">
        <p>
          We use access controls, hashed passwords, one-time reset links, audit logging, and operational monitoring to protect personal information. No online service can guarantee perfect security.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We keep personal information for as long as needed to provide the service, meet legal or accounting requirements, resolve disputes, maintain security, and support legitimate business records.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          South African users may request access, correction, deletion, or objection to processing where applicable under POPIA. Requests can be sent to {legalBusiness.informationOfficerEmail}.
        </p>
      </LegalSection>

      <LegalSection title="8. Breach handling">
        <p>
          If we become aware of a security compromise affecting personal information, we will assess it and notify affected parties and the Information Regulator where required by law.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Privacy questions can be sent to {legalBusiness.informationOfficerEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
