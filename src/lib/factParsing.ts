import type { FactView } from "./types";

export interface LabelValue {
  label: string;
  value: string;
}

export function parseLabelValue(content: string): LabelValue | null {
  const separatorIndex = content.indexOf(": ");
  if (separatorIndex === -1) return null;
  return {
    label: content.slice(0, separatorIndex).trim(),
    value: content.slice(separatorIndex + 2).trim(),
  };
}

export function findBySlot(facts: FactView[], slotLabel: string): FactView | undefined {
  return facts.find((fact) => {
    const parsed = parseLabelValue(fact.content);
    return parsed?.label.toLowerCase() === slotLabel.toLowerCase();
  });
}

export function excludingSlots(facts: FactView[], slotLabels: string[]): FactView[] {
  const lowerSlots = slotLabels.map((label) => label.toLowerCase());
  return facts.filter((fact) => {
    const parsed = parseLabelValue(fact.content);
    return !parsed || !lowerSlots.includes(parsed.label.toLowerCase());
  });
}
