import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { getSeedEnv } from "../lib/env";
import { personalSeedSchema } from "../lib/validators";

const prisma = new PrismaClient();

async function seedCatalog() {
  const seedFile = process.env.SEED_FILE?.trim();
  if (!seedFile) return;

  const fullPath = path.resolve(seedFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error("SEED_FILE does not exist. Values are not logged.");
  }

  const parsed = personalSeedSchema.safeParse(JSON.parse(fs.readFileSync(fullPath, "utf8")));
  if (!parsed.success) {
    throw new Error("SEED_FILE is invalid. Values are not logged.");
  }

  for (const exercise of parsed.data.exercises) {
    const existing = await prisma.exercise.findUnique({ where: { name: exercise.name } });
    if (existing) {
      if (existing.isAssisted !== exercise.isAssisted) {
        await prisma.exercise.update({ where: { id: existing.id }, data: { isAssisted: exercise.isAssisted } });
      }
      continue;
    }
    await prisma.exercise.create({
      data: {
        name: exercise.name,
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: exercise.secondaryMuscles,
        equipment: exercise.equipment,
        isAssisted: exercise.isAssisted,
        isCustom: false,
        setupFields: {
          create: exercise.setupFields.map((field, index) => ({
            label: field.label,
            type: field.type,
            options: field.type === "enum" ? field.options : [],
            order: index,
            defaultValue: field.defaultValue ?? null,
          })),
        },
      },
    });
  }

  const programName = parsed.data.program.name;
  const existingProgram = await prisma.program.findFirst({ where: { name: programName } });
  if (existingProgram) return;

  const names = parsed.data.program.days.flatMap((day) => day.exercises.map((item) => item.name));
  const exercises = await prisma.exercise.findMany({ where: { name: { in: names } } });
  const ids = new Map(exercises.map((exercise) => [exercise.name, exercise.id]));

  await prisma.program.updateMany({ data: { isActive: false } });
  await prisma.program.create({
    data: {
      name: programName,
      isActive: true,
      days: {
        create: parsed.data.program.days.map((day) => ({
          label: day.label,
          order: day.order,
          exercises: {
            create: day.exercises.map((item, index) => {
              const exerciseId = ids.get(item.name);
              if (!exerciseId) throw new Error("Seed program references a missing exercise.");
              const preset =
                item.presetSetup == null ? Prisma.JsonNull : (item.presetSetup satisfies Prisma.InputJsonValue);
              return {
                exerciseId,
                order: index,
                targetSets: item.targetSets,
                targetRepsMin: item.targetRepsMin,
                targetRepsMax: item.targetRepsMax,
                setStyle: item.setStyle,
                presetSetup: preset,
              };
            }),
          },
        })),
      },
    },
  });
}

async function main() {
  const env = getSeedEnv();
  const existing = await prisma.user.findUnique({
    where: { username: env.APP_USERNAME },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username: env.APP_USERNAME,
        passwordHash: env.APP_PASSWORD_HASH,
      },
    });
  }

  await seedCatalog();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    await prisma.$disconnect();
    process.exit(1);
  });
