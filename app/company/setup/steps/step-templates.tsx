"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-data";
import ShiftTemplateFormModal from "@/components/shift-templates/ShiftTemplateFormModal";
import type { ShiftTemplateFormInput } from "@/components/shift-templates/ShiftTemplateFormModal";
import StepListCard from "@/components/company-setup/StepListCard";
import WizardNav from "@/components/company-setup/WizardNav";

interface StepTemplatesProps {
  onBack: () => void;
  onNext: () => void;
}

export default function StepTemplates({ onBack, onNext }: StepTemplatesProps) {
  const { teams, shiftTemplates, createShiftTemplate } = useCompany();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (
    input: ShiftTemplateFormInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!input.teamId) return { ok: false, error: "Please select a team." };
    const result = await createShiftTemplate({ ...input, teamId: input.teamId });
    if (!result.ok) return { ok: false, error: result.error };
    setModalOpen(false);
    return { ok: true };
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">Add shift templates</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Reusable shifts with recurrence rules. You can add more later.
      </p>

      <div className="mt-4">
        <StepListCard
          items={shiftTemplates.map((t) => ({ id: t.id, primary: t.title }))}
          emptyLabel="No shift templates yet."
          addLabel="Add shift template"
          onAdd={() => setModalOpen(true)}
          addDisabled={teams.length === 0}
          addDisabledHint="Add a team first"
        />
      </div>

      <WizardNav
        onBack={onBack}
        onContinue={onNext}
        continueLabel={shiftTemplates.length > 0 ? "Continue" : "Skip"}
      />

      {modalOpen && (
        <ShiftTemplateFormModal
          template={null}
          teams={teams}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
