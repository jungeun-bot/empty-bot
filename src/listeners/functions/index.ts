import type { App } from '@slack/bolt';
import { registerBookRoomFunction } from './book-room.js';
import { registerEditBookingFunction } from './edit-booking.js';
import { registerCancelBookingFunction } from './cancel-booking.js';

export function registerFunctions(app: App): void {
  registerBookRoomFunction(app);
  registerEditBookingFunction(app);
  registerCancelBookingFunction(app);
}
