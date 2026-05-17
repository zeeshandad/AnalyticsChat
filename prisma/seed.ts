import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Initialize the Prisma 7 driver adapter directly with the database path
const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  'Electronics',
  'Apparel',
  'Home & Kitchen',
  'Books',
  'Sports & Fitness',
  'Beauty & Personal Care',
];

// Helper to get random number in range
function getRandomRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Helper to get a random item from array
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing orders
  const deletedOrders = await prisma.order.deleteMany();
  console.log(`🧹 Cleaned up ${deletedOrders.count} existing orders.`);

  // 2. Generate 600 realistic orders spread over the last 4 quarters
  const ordersData: Array<{ amount: number; category: string; createdAt: Date }> = [];
  
  // Current time is May 2026
  const now = new Date('2026-05-17T08:00:00.000Z');
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  console.log(`📅 Generating orders between ${oneYearAgo.toLocaleDateString()} and ${now.toLocaleDateString()}...`);

  // We want to create 600 orders
  const totalOrdersCount = 600;

  for (let i = 0; i < totalOrdersCount; i++) {
    // Generate a random date between one year ago and now
    const randomTime = oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime());
    const createdAt = new Date(randomTime);

    // Select category and define realistic amount range based on category
    const category = getRandomItem(CATEGORIES);
    let amount = 0;

    switch (category) {
      case 'Electronics':
        amount = Math.round(getRandomRange(100, 1500) * 100) / 100;
        break;
      case 'Apparel':
        amount = Math.round(getRandomRange(20, 150) * 100) / 100;
        break;
      case 'Home & Kitchen':
        amount = Math.round(getRandomRange(40, 450) * 100) / 100;
        break;
      case 'Books':
        amount = Math.round(getRandomRange(10, 80) * 100) / 100;
        break;
      case 'Sports & Fitness':
        amount = Math.round(getRandomRange(30, 600) * 100) / 100;
        break;
      case 'Beauty & Personal Care':
        amount = Math.round(getRandomRange(15, 120) * 100) / 100;
        break;
      default:
        amount = Math.round(getRandomRange(10, 200) * 100) / 100;
    }

    // Add some random seasonal multipliers to make charts look cooler!
    // E.g., higher spending in Nov-Dec (Q4 holidays)
    const month = createdAt.getMonth();
    if (month === 10 || month === 11) { // Nov, Dec
      amount = Math.round(amount * 1.35 * 100) / 100;
    } else if (month === 5 || month === 6) { // Summer sales
      amount = Math.round(amount * 1.15 * 100) / 100;
    }

    ordersData.push({
      amount,
      category,
      createdAt,
    });
  }

  // Insert orders in batches to ensure SQLite stability
  const batchSize = 100;
  let seededCount = 0;
  for (let i = 0; i < ordersData.length; i += batchSize) {
    const batch = ordersData.slice(i, i + batchSize);
    await prisma.order.createMany({
      data: batch,
    });
    seededCount += batch.length;
    console.log(`✅ Seeded batch: ${seededCount}/${totalOrdersCount} orders...`);
  }

  console.log(`🎉 Database seeding completed! ${seededCount} orders created successfully.`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
