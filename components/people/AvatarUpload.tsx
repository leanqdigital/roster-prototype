"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Avatar from "./Avatar";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 512 * 1024;

export default function AvatarUpload({
  name,
  src,
  onPick,
}: {
  name: string;
  src?: string | null;
  onPick: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Image must be PNG, JPG, or WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 512KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onPick(reader.result as string);
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={src} className="size-14 text-sm font-semibold" />
      <div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-7 rounded-lg border border-hairline bg-surface-3 px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-4"
          >
            {src ? "Replace photo" : "Upload photo"}
          </button>
          {src && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onPick(null);
              }}
              className="h-7 rounded-lg px-2 text-[12px] font-medium text-ink-subtle transition-colors hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
