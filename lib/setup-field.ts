import { SETUP_FIELD_TYPES, type SetupFieldType } from "@/lib/catalog";

export function isSetupFieldType(value: string): value is SetupFieldType {
  return SETUP_FIELD_TYPES.some((type) => type === value);
}
