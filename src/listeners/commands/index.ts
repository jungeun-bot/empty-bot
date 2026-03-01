import type { App } from '@slack/bolt';
import { registerBookCommand } from './book.js';
import { registerNowBookCommand } from './now-book.js';
import { registerEditCommand } from './edit.js';

export function registerCommands(app: App): void {
  registerBookCommand(app);
  registerNowBookCommand(app);
  registerEditCommand(app);
}
