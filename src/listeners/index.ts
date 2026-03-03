import type { App } from '@slack/bolt';
import { registerCommands } from './commands/index.js';
import { registerViews } from './views/index.js';
import { registerActions } from './actions/index.js';
import { registerOptions } from './options/index.js';
import { registerEvents } from './events/index.js';
import { registerFunctions } from './functions/index.js';

export function registerListeners(app: App): void {
  registerCommands(app);
  registerViews(app);
  registerActions(app);
  registerOptions(app);
  registerEvents(app);
  registerFunctions(app);
}
