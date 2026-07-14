import type { DepositDisposition } from '@project-braids/shared-types/api';

export type BookingDepositDispositionEvent = {
  bookingId: string;
  depositDisposition: DepositDisposition;
};

type BookingDepositDispositionHandler = (
  event: BookingDepositDispositionEvent,
) => void | Promise<void>;

const bookingDepositDispositionHandlers: BookingDepositDispositionHandler[] = [];

/** Ch.9.3 — in-process domain events so Booking does not import Payments. */
export function onBookingDepositDisposition(handler: BookingDepositDispositionHandler): void {
  bookingDepositDispositionHandlers.push(handler);
}

export async function emitBookingDepositDisposition(
  event: BookingDepositDispositionEvent,
): Promise<void> {
  for (const handler of bookingDepositDispositionHandlers) {
    await handler(event);
  }
}

export type BookingConfirmedEvent = {
  bookingId: string;
};

export type BookingCancelledEvent = {
  bookingId: string;
  depositDisposition: DepositDisposition;
};

export type BookingNoShowEvent = {
  bookingId: string;
  depositDisposition: DepositDisposition;
};

export type BookingTimeChangedEvent = {
  bookingId: string;
};

type BookingConfirmedHandler = (event: BookingConfirmedEvent) => void | Promise<void>;
type BookingCancelledHandler = (event: BookingCancelledEvent) => void | Promise<void>;
type BookingNoShowHandler = (event: BookingNoShowEvent) => void | Promise<void>;
type BookingTimeChangedHandler = (event: BookingTimeChangedEvent) => void | Promise<void>;

const bookingConfirmedHandlers: BookingConfirmedHandler[] = [];
const bookingCancelledHandlers: BookingCancelledHandler[] = [];
const bookingNoShowHandlers: BookingNoShowHandler[] = [];
const bookingTimeChangedHandlers: BookingTimeChangedHandler[] = [];

/** Ch.12.2/12.3 — Notifications subscribes without Booking importing Notifications. */
export function onBookingConfirmed(handler: BookingConfirmedHandler): void {
  bookingConfirmedHandlers.push(handler);
}

export function onBookingCancelled(handler: BookingCancelledHandler): void {
  bookingCancelledHandlers.push(handler);
}

export function onBookingNoShow(handler: BookingNoShowHandler): void {
  bookingNoShowHandlers.push(handler);
}

export function onBookingTimeChanged(handler: BookingTimeChangedHandler): void {
  bookingTimeChangedHandlers.push(handler);
}

export async function emitBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
  for (const handler of bookingConfirmedHandlers) {
    await handler(event);
  }
}

export async function emitBookingCancelled(event: BookingCancelledEvent): Promise<void> {
  for (const handler of bookingCancelledHandlers) {
    await handler(event);
  }
}

export async function emitBookingNoShow(event: BookingNoShowEvent): Promise<void> {
  for (const handler of bookingNoShowHandlers) {
    await handler(event);
  }
}

export async function emitBookingTimeChanged(event: BookingTimeChangedEvent): Promise<void> {
  for (const handler of bookingTimeChangedHandlers) {
    await handler(event);
  }
}

export type BookingCreatedEvent = {
  bookingId: string;
  stylistId: string;
  status: string;
};

export type ConversationEscalatedEvent = {
  conversationId: string;
  stylistId: string;
  reason: string;
};

export type ConversationMessageEvent = {
  conversationId: string;
  stylistId: string;
  messageId: string;
};

type BookingCreatedHandler = (event: BookingCreatedEvent) => void | Promise<void>;
type ConversationEscalatedHandler = (event: ConversationEscalatedEvent) => void | Promise<void>;
type ConversationMessageHandler = (event: ConversationMessageEvent) => void | Promise<void>;

const bookingCreatedHandlers: BookingCreatedHandler[] = [];
const conversationEscalatedHandlers: ConversationEscalatedHandler[] = [];
const conversationMessageHandlers: ConversationMessageHandler[] = [];

/** Ch.17.5 — Realtime layer subscribes without cross-module imports. */
export function onBookingCreated(handler: BookingCreatedHandler): void {
  bookingCreatedHandlers.push(handler);
}

export function onConversationEscalated(handler: ConversationEscalatedHandler): void {
  conversationEscalatedHandlers.push(handler);
}

export function onConversationMessage(handler: ConversationMessageHandler): void {
  conversationMessageHandlers.push(handler);
}

export async function emitBookingCreated(event: BookingCreatedEvent): Promise<void> {
  for (const handler of bookingCreatedHandlers) {
    await handler(event);
  }
}

export async function emitConversationEscalated(event: ConversationEscalatedEvent): Promise<void> {
  for (const handler of conversationEscalatedHandlers) {
    await handler(event);
  }
}

export async function emitConversationMessage(event: ConversationMessageEvent): Promise<void> {
  for (const handler of conversationMessageHandlers) {
    await handler(event);
  }
}

export function resetDomainEventsForTests(): void {
  bookingDepositDispositionHandlers.length = 0;
  bookingConfirmedHandlers.length = 0;
  bookingCancelledHandlers.length = 0;
  bookingNoShowHandlers.length = 0;
  bookingTimeChangedHandlers.length = 0;
  bookingCreatedHandlers.length = 0;
  conversationEscalatedHandlers.length = 0;
  conversationMessageHandlers.length = 0;
}
