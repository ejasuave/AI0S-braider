#!/usr/bin/env tsx
import { prisma } from '../src/lib/db.js';

const sampleSize = Number(process.argv[2] ?? 10);

async function main() {
  const escalations = await prisma.escalation.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(sampleSize, 1), 100),
    include: {
      conversation: {
        select: {
          id: true,
          status: true,
          stylist: { select: { businessName: true } },
        },
      },
    },
  });

  if (escalations.length === 0) {
    console.log('No escalation records found.');
    return;
  }

  console.log(`# Escalation review sample (${escalations.length} records)\n`);
  console.log(
    'Review each row: true positive (needed human), false positive (AI escalated unnecessarily), false negative (nearby thread should have escalated).\n',
  );

  for (const row of escalations) {
    console.log(`- ${row.createdAt.toISOString()}`);
    console.log(`  conversation: ${row.conversationId}`);
    console.log(`  stylist: ${row.conversation.stylist.businessName}`);
    console.log(`  reason: ${row.reason}`);
    console.log(`  model_confidence: ${row.modelConfidence ?? 'n/a'}`);
    console.log(`  model_next_action: ${row.modelNextAction ?? 'n/a'}`);
    console.log(`  resolved: ${row.resolvedAt ? 'yes' : 'no'}`);
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
