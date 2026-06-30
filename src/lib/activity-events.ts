import { EventEmitter } from "events";

// Global emitter shared across all requests in this Node process.
// Works for single-instance deployments (Vercel functions are stateless per
// invocation though — see note below).
class ActivityEventBus extends EventEmitter {}

declare global {
  // eslint-disable-next-line no-var
  var __activityEventBus: ActivityEventBus | undefined;
}

export const activityEvents: ActivityEventBus =
  global.__activityEventBus ?? new ActivityEventBus();

if (!global.__activityEventBus) {
  global.__activityEventBus = activityEvents;
}

export function emitNewActivity(userId: string | undefined, activity: unknown) {
  if (!userId) return;
  activityEvents.emit(`activity:${userId}`, activity);
}