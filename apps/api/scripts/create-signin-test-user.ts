import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/modules/identity/crypto.js';

const prisma = new PrismaClient();

async function main() {
  const email = 'signin.test@braids.local';
  const password = 'TestSignIn123!';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      phoneNumber: '+447700900111',
      passwordHash,
      role: 'stylist_owner',
      phoneVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      phoneVerifiedAt: new Date(),
      deactivatedAt: null,
    },
  });
  console.log('ok', user.email, user.role);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
