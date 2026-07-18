"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Please upload a valid CSV file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be under 10MB");
        return;
      }
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "group relative cursor-pointer overflow-hidden border border-dashed px-8 py-14 text-center transition duration-300",
          isDragging
            ? "border-pine bg-pine/8"
            : "border-line bg-surface-raised/60 hover:border-pine/50 hover:bg-surface-raised",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-ember transition-transform duration-500",
            isDragging ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
          )}
        />

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-moss">
          Drop zone
        </p>
        <h3 className="mt-3 font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          Drop your CSV here
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Or click to browse. Facebook leads, Google Ads exports, Excel dumps —
          any column layout works.
        </p>
        <p className="mt-5 font-mono text-[11px] tracking-wide text-muted/80">
          .csv · max 10MB
        </p>
      </div>

      {error && (
        <p className="border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between border border-line bg-surface-raised px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">{selectedFile.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
