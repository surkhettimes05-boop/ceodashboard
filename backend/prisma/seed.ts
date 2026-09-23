import { PrismaClient, RoleType, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function getProductionSeedConfig() {
  const envEmail = process.env.SEED_CEO_EMAIL?.trim();
  const envPassword = process.env.SEED_CEO_PASSWORD?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!envEmail || !envPassword) {
      return {
        enabled: false,
        reason: 'Production seeding is disabled unless SEED_CEO_EMAIL and SEED_CEO_PASSWORD are provided.',
        email: null,
        password: null,
      };
    }

    return {
      enabled: true,
      reason: null,
      email: envEmail,
      password: envPassword,
    };
  }

  return {
    enabled: true,
    reason: null,
    email: 'ceo@startup.com',
    password: 'Admin123!',
  };
}

async function main() {
  console.log('--- Starting Seed Process ---');
  const productionSeed = getProductionSeedConfig();

  if (process.env.NODE_ENV === 'production' && !productionSeed.enabled) {
    console.warn('[seed] Production seeding skipped. Default demo credentials are not created in production.');
    console.warn(`[seed] ${productionSeed.reason}`);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[seed] Production seed mode is enabled with an explicit CEO bootstrap only. Existing data is preserved.');
  }

  // 1. Seed Permissions
  const permissionsList = [
    { code: 'users:view', module: 'users', description: 'View users list and profiles' },
    { code: 'users:create', module: 'users', description: 'Create new user accounts' },
    { code: 'users:edit', module: 'users', description: 'Edit existing users' },
    { code: 'roles:view', module: 'roles', description: 'View roles and permissions' },

    { code: 'sales:create', module: 'sales', description: 'Create sales and POS checkout' },
    { code: 'sales:view', module: 'sales', description: 'View sales history' },
    { code: 'sales:refund', module: 'sales', description: 'Process customer returns/refunds' },

    { code: 'branches:view', module: 'branches', description: 'View branch locations' },
    { code: 'branches:manage', module: 'branches', description: 'Create and update branch locations' },
    { code: 'catalog:view', module: 'catalog', description: 'View products, categories, and units' },
    { code: 'catalog:manage', module: 'catalog', description: 'Create and update products, categories, and units' },
    { code: 'suppliers:view', module: 'suppliers', description: 'View suppliers' },
    { code: 'suppliers:manage', module: 'suppliers', description: 'Create and update suppliers' },
    { code: 'purchases:view', module: 'purchases', description: 'View purchase orders' },
    { code: 'purchases:create', module: 'purchases', description: 'Create purchase orders' },
    { code: 'purchases:receive', module: 'purchases', description: 'Receive purchase orders into inventory' },
    { code: 'warehouses:view', module: 'warehouses', description: 'View warehouses' },
    { code: 'warehouses:manage', module: 'warehouses', description: 'Create and update warehouses' },

    { code: 'inventory:view', module: 'inventory', description: 'View stock levels' },
    { code: 'inventory:adjust', module: 'inventory', description: 'Perform manual stock adjustments' },
    { code: 'inventory:transfer', module: 'inventory', description: 'Initiate stock transfers' },

    { code: 'accounting:view', module: 'accounting', description: 'View Chart of Accounts and General Ledger' },
    { code: 'accounting:post', module: 'accounting', description: 'Create manual journal entries' },

    { code: 'reports:view', module: 'reports', description: 'View operational & financial reports' },
    { code: 'dashboard:view', module: 'dashboard', description: 'View executive dashboard KPIs' },

    // Customer & Loyalty Permissions
    { code: 'CUSTOMER_LOOKUP', module: 'customers', description: 'Lookup customers by phone in POS' },
    { code: 'CUSTOMER_CREATE_POS', module: 'customers', description: 'Fast create customer from POS' },
    { code: 'CUSTOMER_VIEW', module: 'customers', description: 'View customer profiles and history' },
    { code: 'LOYALTY_VIEW', module: 'loyalty', description: 'View loyalty points and ledger' },
    { code: 'LOYALTY_REDEEM', module: 'loyalty', description: 'Redeem loyalty points for discounts' },
    { code: 'LOYALTY_ADJUSTMENT', module: 'loyalty', description: 'Manual loyalty point adjustments (admin)' },
    { code: 'LOYALTY_SETTINGS', module: 'loyalty', description: 'Configure loyalty rules and settings' },

    // Feedback & Complaint Permissions
    { code: 'FEEDBACK_VIEW', module: 'feedback', description: 'View customer feedback and ratings' },
    { code: 'COMPLAINT_VIEW', module: 'complaints', description: 'View complaint tickets' },
    { code: 'COMPLAINT_MANAGE', module: 'complaints', description: 'Create, assign, and resolve complaints' },
  ];

  for (const p of permissionsList) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  console.log(`✓ Permissions seeded (${permissionsList.length})`);

  // 2. Seed Roles
  const rolesData: { name: RoleType; description: string; permissions: string[] }[] = [
    {
      name: 'CEO',
      description: 'Chief Executive Officer - Full platform read access and strategic overview',
      permissions: permissionsList.map((p) => p.code),
    },
    {
      name: 'ADMIN',
      description: 'System Administrator - Full platform configuration and management access',
      permissions: permissionsList.map((p) => p.code),
    },
    {
      name: 'MANAGER',
      description: 'Branch Manager - Operational management, sales, stock adjustments, customer service',
      permissions: [
        'users:view', 'sales:create', 'sales:view', 'sales:refund',
        'branches:view', 'catalog:view', 'catalog:manage', 'suppliers:view', 'suppliers:manage',
        'purchases:view', 'purchases:create', 'purchases:receive', 'warehouses:view',
        'inventory:view', 'inventory:adjust', 'inventory:transfer',
        'reports:view', 'dashboard:view',
        'CUSTOMER_LOOKUP', 'CUSTOMER_CREATE_POS', 'CUSTOMER_VIEW',
        'LOYALTY_VIEW', 'LOYALTY_REDEEM',
        'FEEDBACK_VIEW', 'COMPLAINT_VIEW', 'COMPLAINT_MANAGE'
      ],
    },
    {
      name: 'CASHIER',
      description: 'POS Cashier - High speed POS checkout and personal sales view',
      permissions: [
        'sales:create', 'sales:view', 'sales:refund',
        'branches:view', 'catalog:view',
        'CUSTOMER_LOOKUP', 'CUSTOMER_CREATE_POS', 'LOYALTY_VIEW', 'LOYALTY_REDEEM'
      ],
    },
    {
      name: 'ACCOUNTANT',
      description: 'Financial Accountant - General ledger, journal entries, P&L, balance sheet',
      permissions: [
        'accounting:view', 'accounting:post', 'reports:view', 'sales:view', 'dashboard:view',
        'branches:view', 'catalog:view',
        'CUSTOMER_VIEW', 'LOYALTY_VIEW'
      ],
    },
    {
      name: 'WAREHOUSE_MANAGER',
      description: 'Warehouse Logistics Manager - Receiving, stock counts, transfers',
      permissions: ['inventory:view', 'inventory:adjust', 'inventory:transfer', 'reports:view', 'branches:view', 'catalog:view', 'warehouses:view', 'purchases:view', 'purchases:receive'],
    },
    {
      name: 'B2B_SALES',
      description: 'Wholesale B2B Sales Executive',
      permissions: [
        'sales:create', 'sales:view', 'inventory:view', 'reports:view',
        'branches:view', 'catalog:view',
        'CUSTOMER_LOOKUP', 'CUSTOMER_CREATE_POS', 'CUSTOMER_VIEW', 'LOYALTY_VIEW'
      ],
    },
    {
      name: 'PURCHASING',
      description: 'Purchasing & Procurement Specialist',
      permissions: ['inventory:view', 'reports:view', 'branches:view', 'catalog:view', 'suppliers:view', 'purchases:view', 'purchases:create', 'warehouses:view'],
    },
  ];

  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: {
        name: r.name,
        description: r.description,
      },
    });

    // Link permissions
    const perms = await prisma.permission.findMany({
      where: { code: { in: r.permissions } },
    });

    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: p.id,
          },
        },
        update: {},
        create: {
          role_id: role.id,
          permission_id: p.id,
        },
      });
    }
  }
  console.log(`✓ Roles & Role Permissions seeded`);

  // 3. Seed Main Branch & Central Warehouse
  const mainBranch = await prisma.branch.upsert({
    where: { code: 'BR-MAIN' },
    update: {},
    create: {
      code: 'BR-MAIN',
      name: 'Main Retail Store',
      address: '123 Commercial Avenue, Downtown',
      phone: '+1 555-0199',
    },
  });

  await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: {},
    create: {
      code: 'WH-CENTRAL',
      name: 'Central Warehouse',
      is_central: true,
      branch_id: mainBranch.id,
    },
  });
  console.log(`✓ Main Branch & Central Warehouse seeded`);

  // 4. Seed Default Chart of Accounts
  const chartOfAccounts = [
    { code: '1010', name: 'Cash on Hand', type: AccountType.ASSET, description: 'Physical cash drawer balance' },
    { code: '1020', name: 'Bank Operating Account', type: AccountType.ASSET, description: 'Primary business checking account' },
    { code: '1030', name: 'Accounts Receivable (AR)', type: AccountType.ASSET, description: 'Outstanding B2B customer credit receivables' },
    { code: '1040', name: 'Inventory Asset', type: AccountType.ASSET, description: 'Valuation of stock on hand' },
    { code: '2010', name: 'Accounts Payable (AP)', type: AccountType.LIABILITY, description: 'Outstanding supplier bills' },
    { code: '2020', name: 'Sales Tax Payable', type: AccountType.LIABILITY, description: 'Collected VAT/Sales tax owed to government' },
    { code: '3010', name: 'Owner / Retained Earnings', type: AccountType.EQUITY, description: 'Accumulated business earnings' },
    { code: '4010', name: 'Retail Sales Revenue', type: AccountType.REVENUE, description: 'Revenue from POS store transactions' },
    { code: '4020', name: 'Wholesale B2B Revenue', type: AccountType.REVENUE, description: 'Revenue from wholesale B2B transactions' },
    { code: '5010', name: 'Cost of Goods Sold (COGS)', type: AccountType.EXPENSE, description: 'Direct inventory product costs for sales' },
    { code: '6010', name: 'Rent & Lease Expense', type: AccountType.EXPENSE, description: 'Store & warehouse rent' },
    { code: '6020', name: 'Utilities & Internet Expense', type: AccountType.EXPENSE, description: 'Electricity, internet, water' },
    { code: '6030', name: 'Salaries & Wages Expense', type: AccountType.EXPENSE, description: 'Staff payroll' },
  ];

  for (const acc of chartOfAccounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    });
  }
  console.log(`✓ Chart of Accounts seeded (${chartOfAccounts.length} accounts)`);

  // 5. Seed default catalog categories and units
  const defaultCategories = [
    'Grocery',
    'Beverages',
    'Snacks',
    'Dairy',
    'Household',
    'Personal Care',
    'Other',
  ];

  for (const name of defaultCategories) {
    await prisma.category.upsert({
      where: { name },
      update: { description: 'Default catalog category' },
      create: { name, description: 'Default catalog category' },
    });
  }
  console.log(`✓ Default categories seeded (${defaultCategories.length})`);

  const defaultUnits = [
    { name: 'pcs', abbreviation: 'pcs' },
    { name: 'kg', abbreviation: 'kg' },
    { name: 'g', abbreviation: 'g' },
    { name: 'litre', abbreviation: 'L' },
    { name: 'ml', abbreviation: 'ml' },
    { name: 'pack', abbreviation: 'pack' },
    { name: 'box', abbreviation: 'box' },
    { name: 'dozen', abbreviation: 'dz' },
  ];

  for (const unit of defaultUnits) {
    await prisma.unit.upsert({
      where: { name: unit.name },
      update: { abbreviation: unit.abbreviation },
      create: {
        name: unit.name,
        abbreviation: unit.abbreviation,
      },
    });
  }
  console.log(`✓ Default units seeded (${defaultUnits.length})`);

  // 6. Seed Initial Users (Production path is intentionally limited to CEO bootstrap only)
  const defaultPasswordAdmin = 'Admin123!';
  const defaultPasswordCashier = 'Cashier123!';
  const passwordHashAdmin = await bcrypt.hash(defaultPasswordAdmin, 10);
  const passwordHashCashier = await bcrypt.hash(defaultPasswordCashier, 10);

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const ceoRole = await prisma.role.findUnique({ where: { name: 'CEO' } });
  const cashierRole = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
  const accountantRole = await prisma.role.findUnique({ where: { name: 'ACCOUNTANT' } });

  if (adminRole && ceoRole && cashierRole && accountantRole) {
    if (process.env.NODE_ENV === 'production') {
      const password = productionSeed.password;
      const email = productionSeed.email;

      if (password && email) {
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.upsert({
          where: { email },
          update: { username: 'ceo', full_name: 'Chief Executive Officer', role_id: ceoRole.id, branch_id: mainBranch.id },
          create: {
            username: 'ceo',
            email,
            full_name: 'Chief Executive Officer',
            password_hash: hash,
            role_id: ceoRole.id,
            branch_id: mainBranch.id,
          },
        });
        console.log(`[seed] Production CEO bootstrap created for ${email}.`);
        console.log('[seed] Save this password immediately in the deployment record; it is not reprinted on subsequent runs.');
      }
    } else {
      await prisma.user.upsert({
        where: { username: 'ceo' },
        update: {},
        create: {
          username: 'ceo',
          email: 'ceo@startup.com',
          full_name: 'Chief Executive Officer',
          password_hash: passwordHashAdmin,
          role_id: ceoRole.id,
          branch_id: mainBranch.id,
        },
      });

      await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          username: 'admin',
          email: 'admin@startup.com',
          full_name: 'System Administrator',
          password_hash: passwordHashAdmin,
          role_id: adminRole.id,
          branch_id: mainBranch.id,
        },
      });

      await prisma.user.upsert({
        where: { username: 'cashier' },
        update: {},
        create: {
          username: 'cashier',
          email: 'cashier1@startup.com',
          full_name: 'Jane Cashier',
          password_hash: passwordHashCashier,
          role_id: cashierRole.id,
          branch_id: mainBranch.id,
        },
      });

      await prisma.user.upsert({
        where: { username: 'accountant' },
        update: {},
        create: {
          username: 'accountant',
          email: 'accountant@startup.com',
          full_name: 'Robert Accountant',
          password_hash: passwordHashAdmin,
          role_id: accountantRole.id,
          branch_id: mainBranch.id,
        },
      });
      console.log(`✓ Sample Users seeded (ceo, admin, cashier, accountant)`);
    }
  }

  // 7. Seed initial demo products with opening inventory
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] Production mode: demo catalog and inventory seeding is intentionally skipped.');
  } else {
    const groceryCategory = await prisma.category.findUnique({ where: { name: 'Grocery' } });
    const packUnit = await prisma.unit.findUnique({ where: { name: 'pack' } });
    const litreUnit = await prisma.unit.findUnique({ where: { name: 'litre' } });
    const cashierUser = await prisma.user.findUnique({ where: { username: 'cashier' } });

    if (groceryCategory && packUnit && cashierUser) {
      const demoProducts = [
        { sku: 'NDS-001', barcode: '123456789001', name: 'Noodles', categoryId: groceryCategory.id, unitId: packUnit.id, costPrice: 12, sellingPrice: 20, openingStock: 25 },
        { sku: 'MIL-002', barcode: '123456789002', name: 'Fresh Milk', categoryId: groceryCategory.id, unitId: litreUnit?.id ?? packUnit.id, costPrice: 80, sellingPrice: 120, openingStock: 18 },
        { sku: 'SOAP-003', barcode: '123456789003', name: 'Hand Soap', categoryId: groceryCategory.id, unitId: packUnit.id, costPrice: 35, sellingPrice: 65, openingStock: 30 },
      ];

      for (const product of demoProducts) {
        const createdProduct = await prisma.product.upsert({
          where: { sku: product.sku },
          update: {
            barcode: product.barcode,
            name: product.name,
            category_id: product.categoryId,
            unit_id: product.unitId,
            cost_price: product.costPrice,
            selling_price: product.sellingPrice,
          },
          create: {
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            category_id: product.categoryId,
            unit_id: product.unitId,
            cost_price: product.costPrice,
            selling_price: product.sellingPrice,
            wholesale_price: product.sellingPrice * 0.8,
            min_stock_level: 5,
          },
        });

        if (product.openingStock > 0) {
          await prisma.stockBalance.upsert({
            where: {
              product_id_location_id: {
                product_id: createdProduct.id,
                location_id: mainBranch.id,
              },
            },
            update: { quantity: product.openingStock },
            create: {
              product_id: createdProduct.id,
              location_type: 'BRANCH',
              location_id: mainBranch.id,
              quantity: product.openingStock,
            },
          });

          await prisma.inventoryTransaction.create({
            data: {
              product_id: createdProduct.id,
              location_type: 'BRANCH',
              location_id: mainBranch.id,
              movement_type: 'OPENING_STOCK',
              quantity: product.openingStock,
              unit_cost: product.costPrice,
              reference_type: 'PRODUCT',
              reference_id: createdProduct.id,
              user_id: cashierUser.id,
              notes: `Opening stock seeded for ${createdProduct.name}`,
            },
          });
        }
      }
    }
    console.log('✓ Demo products seeded with opening inventory');
  }

  console.log('--- Seed Finished Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
