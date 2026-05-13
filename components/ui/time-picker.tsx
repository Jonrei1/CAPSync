"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
};

function clampTime(value: string, min?: string, max?: string) {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

export function TimePicker({ value, onChange, id, min, max, className }: TimePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const clamped = clampTime(v, min, max);
    if (clamped !== v) onChange(clamped);
  };

  return (
    <Input
      id={id}
      type="time"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      className={cn(className)}
    />
  );
}
