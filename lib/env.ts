import { z } from "zod";

const runtimeEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  AUTH_SECRET: z.string().min(32),
  APP_USERNAME: z.string().min(1),
  HEIGHT_CM: z.coerce.number().positive().max(300),
  BODYWEIGHT_KG: z.coerce.number().positive().max(500),
});

const passwordHashSchema = z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);

const seedEnvSchema = runtimeEnvSchema.extend({
  APP_PASSWORD_HASH: passwordHashSchema,
});

export type ServerEnv = z.infer<typeof runtimeEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

let cached: ServerEnv | undefined;

function invalidEnv(keys: string): Error {
  return new Error(
    `Invalid server environment (${keys}). Fill .env from .env.example. Values are not logged.`,
  );
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = runtimeEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw invalidEnv(keys);
  }

  cached = parsed.data;
  return cached;
}

/** Seed-only. Prisma loads this value; the Next.js server must not read it because `$` in bcrypt hashes gets expanded. */
export function getSeedEnv(): SeedEnv {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw invalidEnv(keys);
  }
  return parsed.data;
}
