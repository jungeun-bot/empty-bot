import type { App } from '@slack/bolt';
import { registerMentionHandler } from './mention.js';
import { registerDmHandler } from './dm.js';

export function registerEvents(app: App): void {
  registerMentionHandler(app);
  registerDmHandler(app);
}
