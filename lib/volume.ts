export type VolumePartial = {
  reps: number | null;
  weight: number | null;
};

export type VolumeSet = {
  type: string;
  weight: number;
  reps: number;
  isCompleted: boolean;
  partials?: VolumePartial[] | null;
};

export type VolumeExercise = {
  name: string;
  equipment: string;
  isAssisted: boolean;
};

export type VolumeEntry = {
  set: VolumeSet;
  exercise: VolumeExercise;
};

function countsTowardVolume(type: string): boolean {
  return type === "working" || type === "amrap" || type === "drop" || type === "failure" || type === "negative";
}

function loadVolume(weight: number, reps: number, exercise: VolumeExercise, bodyweight: number): number {
  if (reps <= 0) return 0;
  if (exercise.isAssisted) return Math.max(bodyweight - Math.abs(weight), 0) * reps;
  if (exercise.equipment === "bodyweight") return (bodyweight + weight) * reps;
  return weight * reps;
}

export function setVolumeKg(set: VolumeSet, exercise: VolumeExercise, latestBodyweightKg: number | null): number {
  if (!set.isCompleted || !countsTowardVolume(set.type)) return 0;
  const bodyweight = latestBodyweightKg ?? 0;
  const partials = set.partials?.filter((part) => part.reps != null && part.weight != null) ?? [];
  if (partials.length) {
    return partials.reduce((sum, part) => sum + loadVolume(part.weight ?? 0, part.reps ?? 0, exercise, bodyweight), 0);
  }
  if (set.reps <= 0) return 0;
  return loadVolume(set.weight, set.reps, exercise, bodyweight);
}

export function loggedTonnageKg(set: VolumeSet): number {
  if (!set.isCompleted) return 0;
  if (set.partials?.length) {
    return set.partials.reduce((sum, part) => {
      if (part.reps == null || part.weight == null || part.reps <= 0) return sum;
      return sum + part.reps * Math.abs(part.weight);
    }, 0);
  }
  if (set.reps <= 0) return 0;
  return set.reps * Math.abs(set.weight);
}

export function effortReps(set: VolumeSet): number {
  if (!set.isCompleted || set.type === "warmup") return 0;
  if (set.partials?.length) {
    const sum = set.partials.reduce((total, part) => total + (part.reps ?? 0), 0);
    if (sum > 0) return sum;
  }
  return set.reps;
}

export function sessionVolumeKg(entries: VolumeEntry[], latestBodyweightKg: number | null): number {
  return entries.reduce((sum, entry) => sum + setVolumeKg(entry.set, entry.exercise, latestBodyweightKg), 0);
}

export function workingSetCount(sets: VolumeSet[]): number {
  return sets.filter((set) => set.isCompleted && set.type !== "warmup").length;
}

export function workingReps(sets: VolumeSet[]): number {
  return sets.reduce((sum, set) => sum + effortReps(set), 0);
}
