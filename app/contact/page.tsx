import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legalBusiness } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Contact | ${legalBusiness.productName}`
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Business contact details"
      description="Use these contact details for support, privacy, billing, and legal notices."
    >
      <LegalSection title="Business">
        <p>Trading name: {legalBusiness.productName}</p>
        <p>Legal name: {legalBusiness.legalName}</p>
        <p>Country: {legalBusiness.country}</p>
      </LegalSection>

      <LegalSection title="Support and billing">
        <p>Email: {legalBusiness.contactEmail}</p>
      </LegalSection>

      <LegalSection title="Privacy and POPIA requests">
        <p>Email: {legalBusiness.informationOfficerEmail}</p>
      </LegalSection>

      <LegalSection title="Before broad paid launch">
        <p>
          Replace these details with the registered business name, registration number, physical or service address, and verified support email that customers can actually use.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
