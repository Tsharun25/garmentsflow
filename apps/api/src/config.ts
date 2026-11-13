import { z } from 'zod';
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  SESSION_SECRET: z
    .string()
    .min(48)
    .refine((value) => !value.startsWith('REPLACE_'), 'Generate a private random session secret'),
  CLIENT_URL: z.url().default('http://127.0.0.1:5173'),
});
