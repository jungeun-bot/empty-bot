import type { App } from '@slack/bolt';
import { registerBookRoomFunction } from './book-room.js';
import { registerEditBookingFunction } from './edit-booking.js';
import { registerCancelBookingFunction } from './cancel-booking.js';
import { registerBookTodayMeetingFunction } from './book-today-meeting.js';
import { registerOpenFormFunctions } from './open-forms.js';

export function registerFunctions(app: App): void {
  registerBookRoomFunction(app);
  registerEditBookingFunction(app);
  registerCancelBookingFunction(app);
  registerBookTodayMeetingFunction(app);
  registerOpenFormFunctions(app);
}
