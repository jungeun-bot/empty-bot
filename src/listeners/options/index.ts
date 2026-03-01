import type { App } from '@slack/bolt';
import { registerAttendeeOptions } from './attendee-options.js';

export function registerOptions(app: App): void {
  registerAttendeeOptions(app);
}
