export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hams",
  "glutes",
  "calves",
  "abs",
] as const;

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "bodyweight",
  "ez-bar",
  "other",
] as const;

export const SETUP_FIELD_TYPES = ["number", "text", "enum"] as const;

export type Muscle = (typeof MUSCLES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type SetupFieldType = (typeof SETUP_FIELD_TYPES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hams: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  smith: "Smith",
  bodyweight: "Bodyweight",
  "ez-bar": "EZ-bar",
  other: "Other",
};

export function isMuscle(value: string): value is Muscle {
  return MUSCLES.some((muscle) => muscle === value);
}

export function isEquipment(value: string): value is Equipment {
  return EQUIPMENT.some((item) => item === value);
}
