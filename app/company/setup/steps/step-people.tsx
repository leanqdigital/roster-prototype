"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import PersonFormModal from "@/components/people/PersonFormModal";
import type { PersonFormInput } from "@/components/people/PersonFormModal";
import StepListCard from "@/components/company-setup/StepListCard";
import WizardNav from "@/components/company-setup/WizardNav";

interface StepPeopleProps {
  onBack: () => void;
  onNext: () => void;
}

export default function StepPeople({ onBack, onNext }: StepPeopleProps) {
  const { teams, locations, people, invitePerson } = useCompany();
  const { registerEmployee } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (
    input: PersonFormInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await invitePerson({
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      teamIds: input.teamIds,
      locationId: input.locationId,
      timezone: input.timezone,
    });
    if (!result.ok || !result.personId) {
      return { ok: false, error: result.error };
    }
    const account = await registerEmployee({
      email: input.email.trim().toLowerCase(),
      personId: result.personId,
      name: input.name.trim(),
      role: input.role,
    });
    if (!account.ok) {
      return { ok: false, error: account.error };
    }
    setModalOpen(false);
    return { ok: true };
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">Invite people</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Bring your team on board. You can invite more later.
      </p>

      <div className="mt-4">
        <StepListCard
          items={people.map((p) => ({ id: p.id, primary: p.name, secondary: p.email }))}
          emptyLabel="No people invited yet."
          addLabel="Invite person"
          onAdd={() => setModalOpen(true)}
        />
      </div>

      <WizardNav
        onBack={onBack}
        onContinue={onNext}
        continueLabel={people.length > 0 ? "Continue" : "Skip"}
      />

      {modalOpen && (
        <PersonFormModal
          person={null}
          teams={teams}
          locations={locations}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
