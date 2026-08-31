"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { LocationInput } from "@/lib/company-data";
import LocationFormModal from "@/components/locations/LocationFormModal";
import StepListCard from "@/components/company-setup/StepListCard";
import WizardNav from "@/components/company-setup/WizardNav";

interface StepLocationsProps {
  onBack: () => void;
  onNext: () => void;
}

export default function StepLocations({ onBack, onNext }: StepLocationsProps) {
  const { locations, createLocation } = useCompany();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (
    input: LocationInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    const location = await createLocation(input);
    if (!location) {
      return {
        ok: false,
        error: "Location name can't be empty or match an existing location.",
      };
    }
    setModalOpen(false);
    return { ok: true };
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">Add locations</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Set up the sites people work from. You can add more later.
      </p>

      <div className="mt-4">
        <StepListCard
          items={locations.map((l) => ({ id: l.id, primary: l.name }))}
          emptyLabel="No locations yet."
          addLabel="Add location"
          onAdd={() => setModalOpen(true)}
        />
      </div>

      <WizardNav
        onBack={onBack}
        onContinue={onNext}
        continueLabel={locations.length > 0 ? "Continue" : "Skip"}
      />

      {modalOpen && (
        <LocationFormModal
          mode="create"
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
