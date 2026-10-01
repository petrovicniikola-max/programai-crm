import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for seed');

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    create: {
      name: 'Demo Tenant',
      slug: 'demo',
      settings: {
        create: {
          jwtAccessTtlMinutes: 10080,
          notificationsDaysBefore: [30, 14, 7, 1],
        },
      },
    },
    update: {},
    include: { settings: true },
  });

  if (!tenant.settings) {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        jwtAccessTtlMinutes: 10080,
        notificationsDaysBefore: [30, 14, 7, 1],
      },
    });
  }

  const ticketSettingsExists = await prisma.ticketSettings.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!ticketSettingsExists) {
    await prisma.ticketSettings.create({
      data: { tenantId: tenant.id },
    });
  }

  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@demo.local' },
    },
    create: {
      email: 'admin@demo.local',
      displayName: 'Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      tenantId: tenant.id,
    },
    update: { passwordHash, role: 'SUPER_ADMIN', displayName: 'Admin' },
  });

  // Demo kompanija/uređaj/licenca se kreiraju samo kad je SEED_DEMO=true.
  // U produkciji ostavi neuključeno da ne bi zaprljalo statistiku dashboarda.
  if (process.env.SEED_DEMO === 'true') {
    const demoCompany = await prisma.company.upsert({
      where: { id: 'seed-company-demo' },
      create: {
        id: 'seed-company-demo',
        tenantId: tenant.id,
        name: 'Demo Company',
      },
      update: { name: 'Demo Company' },
    });

    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 7);

    await prisma.device.upsert({
      where: {
        tenantId_serialNo: { tenantId: tenant.id, serialNo: 'DEMO-SN-001' },
      },
      create: {
        tenantId: tenant.id,
        companyId: demoCompany.id,
        name: 'Demo Device',
        model: 'Fiscal Pro',
        serialNo: 'DEMO-SN-001',
        status: 'ACTIVE',
      },
      update: {},
    });

    const licence = await prisma.licence.findFirst({
      where: { tenantId: tenant.id, productName: 'Teron Fiscal Pro (Demo)' },
    });
    if (!licence) {
      await prisma.licence.create({
        data: {
          tenantId: tenant.id,
          companyId: demoCompany.id,
          productName: 'Teron Fiscal Pro (Demo)',
          validTo,
          status: 'ACTIVE',
        },
      });
    } else {
      await prisma.licence.update({
        where: { id: licence.id },
        data: { validTo },
      });
    }
  }

  const qaPassword = process.env.SEED_QA_PASSWORD || 'Test123!';
  const qaHash = await bcrypt.hash(qaPassword, 10);

  const support = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'support1@demo.local' } },
    create: {
      email: 'support1@demo.local',
      displayName: 'Support QA',
      passwordHash: qaHash,
      role: 'SUPPORT',
      tenantId: tenant.id,
    },
    update: { passwordHash: qaHash, role: 'SUPPORT', displayName: 'Support QA' },
  });

  const user1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'user1@demo.local' } },
    create: {
      email: 'user1@demo.local',
      displayName: 'User QA',
      passwordHash: qaHash,
      role: 'USER',
      tenantId: tenant.id,
      employmentDate: new Date('2024-01-15'),
      leaveApproverId: support.id,
      jobTitle: 'IT Support',
    },
    update: {
      passwordHash: qaHash,
      role: 'USER',
      displayName: 'User QA',
      employmentDate: new Date('2024-01-15'),
      leaveApproverId: support.id,
      jobTitle: 'IT Support',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sales1@demo.local' } },
    create: {
      email: 'sales1@demo.local',
      displayName: 'Sales QA',
      passwordHash: qaHash,
      role: 'SALES',
      tenantId: tenant.id,
    },
    update: { passwordHash: qaHash, role: 'SALES', displayName: 'Sales QA' },
  });

  void user1;

  const platformAdminEmail = 'platform@local';
  const platformAdminPassword = process.env.SEED_PLATFORM_PASSWORD || 'Platform123!';
  const platformAdminHash = await bcrypt.hash(platformAdminPassword, 10);
  const existingPlatform = await prisma.user.findFirst({
    where: { email: platformAdminEmail, isPlatformAdmin: true, tenantId: null },
  });
  if (!existingPlatform) {
    await prisma.user.create({
      data: {
        email: platformAdminEmail,
        displayName: 'Platform Admin',
        passwordHash: platformAdminHash,
        role: 'SUPER_ADMIN',
        isPlatformAdmin: true,
        tenantId: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingPlatform.id },
      data: { passwordHash: platformAdminHash, displayName: 'Platform Admin' },
    });
  }

  console.log(
    'Seed completed: admin@demo.local (Admin123!), support1/sales1/user1@demo.local (Test123!), platform@local',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
