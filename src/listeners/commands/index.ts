import type { App } from '@slack/bolt';
import { registerBookCommand } from './book.js';
import { registerNowBookCommand } from './now-book.js';
import { registerEditCommand } from './edit.js';
import { registerSetupBookingCommand } from './setup-booking.js';
import { registerReportCommand } from './report.js';
import { registerHelpCommand } from './help.js';

export function registerCommands(app: App): void {
  registerBookCommand(app);
  registerNowBookCommand(app);
  registerEditCommand(app);
  registerSetupBookingCommand(app);
  registerReportCommand(app);
  registerHelpCommand(app);
}
