import { PrismaClient } from '@prisma/client';
import { STYLE_TAXONOMY_SEED } from '@project-braids/shared-types/api';

const prisma = new PrismaClient();

async function main(): Promise<void> {
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
