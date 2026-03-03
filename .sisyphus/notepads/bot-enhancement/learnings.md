
## T7: Book Modal Room Type Selection
- Slack `section` block with `radio_buttons` accessory triggers action events (unlike `input` blocks)
- `views.update` with full modal rebuild is the cleanest way to show/hide fields dynamically
- `private_metadata` is the standard way to pass state (channelId, roomType) between modal interactions
- Focusing room flow: capacity=1, attendees=[], uses `getRoomsByType('focusing')` instead of `getAvailableRooms`
- Pattern: extract metadata EARLY in handler, then branch on roomType before field-specific logic
- `body.channel?.id` may be empty in modal contexts; `body.view?.id` is the correct reference for view updates