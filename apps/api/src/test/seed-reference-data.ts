import { PrismaClient } from '@prisma/client';
import { STYLE_TAXONOMY_SEED } from '@project-braids/shared-types/api';

export async function seedReferenceData(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.schemaVersion.upsert({
      where: { label: 'bootstrap' },
      update: {},
      create: { label: 'bootstrap' },
    });

    for (const category of STYLE_TAXONOMY_SEED) {
      await prisma.styleCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          sizeTiers: [...category.sizeTiers],
          lengthTiers: [...category.lengthTiers],
          sortOrder: category.sortOrder,
        },
        create: {
          name: category.name,
          slug: category.slug,
          sizeTiers: [...category.sizeTiers],
          lengthTiers: [...category.lengthTiers],
          sortOrder: category.sortOrder,
        },
      });
    }

    for (const category of STYLE_TAXONOMY_SEED) {
      if (!category.parentSlug) continue;
      const parent = await prisma.styleCategory.findUnique({
        where: { slug: category.parentSlug },
        select: { id: true },
      });
      if (!parent) continue;
      await prisma.styleCategory.update({
        where: { slug: category.slug },
        data: { parentId: parent.id },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
