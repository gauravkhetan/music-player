export const appEnv = {
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  localSeedPath: process.env.LOCAL_SEED_PATH ?? "data/sample-library.json"
};
