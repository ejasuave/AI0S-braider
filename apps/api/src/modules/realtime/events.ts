import {
  onBookingCreated,
  onConversationEscalated,
  onConversationMessage,
} from '../../lib/domain-events.js';
import { realtimeHub } from './hub.js';

/** Ch.17.5 — bridge domain events to stylist SSE subscribers. */
onBookingCreated(({ bookingId, stylistId, status }) => {
  realtimeHub.publish(stylistId, {
    type: 'booking_created',
    data: { bookingId, status },
  });
});

onConversationEscalated(({ conversationId, stylistId, reason }) => {
  realtimeHub.publish(stylistId, {
    type: 'conversation_escalated',
    data: { conversationId, reason },
  });
});

onConversationMessage(({ conversationId, stylistId, messageId }) => {
  realtimeHub.publish(stylistId, {
    type: 'conversation_message',
    data: { conversationId, messageId },
  });
});
