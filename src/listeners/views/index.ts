import type { App } from '@slack/bolt';
import { registerBookSubmit } from './book-submit.js';
import { registerNowBookSubmit } from './now-book-submit.js';
import { registerEditSubmit } from './edit-submit.js';

export function registerViews(app: App): void {
  registerBookSubmit(app);
  registerNowBookSubmit(app);
  registerEditSubmit(app);
}
