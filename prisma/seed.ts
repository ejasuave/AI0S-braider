import { PrismaClient } from '@prisma/client';
import { STYLE_TAXONOMY_SEED } from '@project-braids/shared-types/api';

const prisma = new PrismaClient();

async function seedStyleTaxonomy(client: PrismaClient): Promise<void> {
  // Pass 1: upsert all rows without parent links
  for (const category of STYLE_TAXONOMY_SEED) {
    await client.styleCategory.upsert({
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

  // Pass 2: wire parentId from parentSlug
  for (const category of STYLE_TAXONOMY_SEED) {
    if (!category.parentSlug) continue;
    const parent = await client.styleCategory.findUnique({
      where: { slug: category.parentSlug },
      select: { id: true },
    });
    if (!parent) continue;
    await client.styleCategory.update({
      where: { slug: category.slug },
      data: { parentId: parent.id },
    });
  }
}

async function main(): Promise<void> {
  await prisma.schemaVersion.upsert({
    where: { label: 'bootstrap' },
    update: {},
    create: { label: 'bootstrap' },
  });

  await seedStyleTaxonomy(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
