import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legalBusiness } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms | ${legalBusiness.productName}`
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      description="These terms explain the rules for using TradeFlow SA during pilot and early-access use."
    >
      <LegalSection title="1. Who we are">
        <p>
          {legalBusiness.productName} provides web-based tools for South African service businesses to manage customers, services, quotes, invoices, PDFs, and related workflow records.
        </p>
        <p>
          These terms are a practical starting point and should be reviewed by a qualified South African attorney before broad paid launch.
        </p>
      </LegalSection>

      <LegalSection title="2. Using the service">
        <p>
          You must provide accurate account and business information, keep your login details secure, and use the service only for lawful business purposes.
        </p>
        <p>
          You are responsible for the customer, quote, invoice, banking, tax, and business information you enter into the service.
        </p>
      </LegalSection>

      <LegalSection title="3. Customer records and documents">
        <p>
          The service helps generate operational documents such as quotes and invoices. You remain responsible for checking document accuracy, pricing, VAT treatment, payment terms, and customer details before sending them.
        </p>
      </LegalSection>

      <LegalSection title="4. Availability and changes">
        <p>
          During pilots and early access, features may change as the product improves. We aim to keep the service available, but we do not guarantee uninterrupted access.
        </p>
      </LegalSection>

      <LegalSection title="5. Paid plans">
        <p>
          If billing is enabled, subscription fees, billing intervals, and cancellation terms will be shown before purchase.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>
          You may not use the service to send unlawful, misleading, abusive, infringing, or fraudulent content, or to interfere with the security or operation of the platform.
        </p>
      </LegalSection>

      <LegalSection title="7. Liability">
        <p>
          To the extent allowed by South African law, the service is provided without warranties that it will meet every business, accounting, tax, or legal requirement. We are not liable for indirect losses, lost profits, or business interruption.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>
          Questions about these terms can be sent to {legalBusiness.contactEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
