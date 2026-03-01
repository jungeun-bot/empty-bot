import type { App } from '@slack/bolt';
import { registerRoomSelectActions } from './room-select.js';
import { registerBookTypeSelectAction } from './book-type-select.js';

export function registerActions(app: App): void {
  registerRoomSelectActions(app);
  registerBookTypeSelectAction(app);
}
