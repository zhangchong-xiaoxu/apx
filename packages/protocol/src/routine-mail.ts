import { z } from "zod";
import { Id, MailServer } from "./domain.ts";
import type { MethodDef } from "./methods.ts";

export const RoutineMailConfig = z
  .object({
    smtp: MailServer.extend({ tls: z.enum(["implicit", "starttls"]) }).strict(),
    from: z.email().max(254),
    to: z.email().max(254),
    secret: z.string().regex(/^secret:\/\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/),
  })
  .strict();
export type RoutineMailConfig = z.infer<typeof RoutineMailConfig>;

export const RoutineMailContent = z
  .object({
    day: z.iso.date(),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^\r\n]+$/),
    text: z.string().trim().min(1).max(100_000),
    html: z.string().max(100_000).optional(),
  })
  .strict();
export type RoutineMailContent = z.infer<typeof RoutineMailContent>;

export const routineMailMethods = {
  "routines.mail_set": {
    params: z.object({ routine: Id, config: RoutineMailConfig.nullable() }).strict(),
    result: z.object({ configured: z.boolean() }),
    effect: true,
    access: "human",
  },
  "routines.mail_get": {
    params: z.object({ routine: Id }).strict(),
    result: z.object({
      config: RoutineMailConfig.nullable(),
      storage: z.enum(["keychain", "dpapi", "secret-service", "file"]),
      credential_set: z.boolean(),
    }),
    effect: false,
    access: "human",
  },
  "routines.mail_send": {
    params: RoutineMailContent.extend({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    result: z.object({ state: z.literal("sent"), duplicate: z.boolean() }),
    effect: true,
    replay: false,
    open: true,
    local: true,
  },
  "routines.mail_retry": {
    params: z.object({ routine: Id, day: z.iso.date() }).strict(),
    result: z.object({ ready: z.literal(true) }),
    effect: true,
    access: "human",
  },
} as const satisfies Record<string, MethodDef>;
