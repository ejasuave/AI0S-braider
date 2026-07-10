# Project Braids — Overview

**Codename:** Project Braids (`PLATFORM_DISPLAY_NAME` via env)  
**Market:** UK only at launch

## What this is

An AI receptionist and operating system for independent hair braiders and hairstylists — not a generic salon booking platform. The core value is a completed, confirmed, paid booking with minimal stylist effort.

## Goals (MVP)

- SMS AI receptionist handles booking conversations for stylists' existing clients
- Structured pricing, deposits, calendar, and notifications
- Stylist dashboard for escalations and oversight
- 10–20 pilot stylists in public beta (M7)

## Tech stack (summary)

Next.js + shadcn/ui (mobile-first web) · Fastify API · Prisma · Supabase Postgres + Storage · Claude · Stripe Connect · Twilio SMS · Vercel + managed API host

Full detail: [product-blueprint.md](../requirements/product-blueprint.md)

## Out of scope for MVP

Public directory, WhatsApp, web booking widget/form, analytics platform, reviews, native apps, OpenAI/LangGraph, Supabase Auth

## Authoritative docs

Start with [reference/README.md](../README.md)
