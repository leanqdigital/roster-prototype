import type { Metadata } from "next";
import SetupWizard from "./setup-wizard";

export const metadata: Metadata = {
  title: "Set up your company",
};

export default function CompanySetupPage() {
  return <SetupWizard />;
}
