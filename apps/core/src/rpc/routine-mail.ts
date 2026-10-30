import type { RoutineMail } from "../engine/routine-mail.ts";
import type { Handlers } from "./router.ts";

export function routineMailHandlers(mail: RoutineMail) {
  return {
    "routines.mail_set": ({ routine, config }) => mail.configure(routine, config),
    "routines.mail_get": ({ routine }) => mail.config(routine),
    "routines.mail_send": ({ token, ...content }) => mail.send(token, content),
    "routines.mail_retry": ({ routine, day }) => mail.retry(routine, day),
  } satisfies Partial<Handlers>;
}
