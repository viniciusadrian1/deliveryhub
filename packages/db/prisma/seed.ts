import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const platforms = [
    { code: 'ifood', name: 'iFood', colorHex: '#EA1D2C', active: true },
    { code: 'rappi', name: 'Rappi', colorHex: '#FF441F', active: false },
    { code: '99food', name: '99Food', colorHex: '#FE3324', active: false },
    { code: 'keeta', name: 'Keeta', colorHex: '#FFCC00', active: false },
    { code: 'ubereats', name: 'Uber Eats', colorHex: '#06C167', active: false },
    { code: 'aiqfome', name: 'AiQfome', colorHex: '#E2231A', active: false },
  ];

  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }

  console.warn(`Seeded ${platforms.length} platforms`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
