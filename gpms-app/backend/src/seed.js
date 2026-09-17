import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { pool, tx } from './db.js'

export const ROLES = [
  ['requester', 'End User', 'Raises gate pass requests'],
  ['vendor', 'Registered Person', 'Vendor / contractor raising inward requests'],
  ['approver', 'Approver', 'Approves or rejects requests'],
  ['security', 'Security Officer', 'Verifies passes and visitors at the gate'],
  ['store', 'Store Person', 'Weighbridge, master data, direct gate passes, reports'],
  ['admin', 'Super Admin', 'Users, roles, analytics and full access'],
]

export const SCREENS = [
  ['dashboard', 'Dashboard', 'General'],
  ['NRGP', 'NRGP', 'Gate Passes'],
  ['RGP', 'RGP', 'Gate Passes'],
  ['SCRAP', 'Scrap Outward', 'Gate Passes'],
  ['INWARD', 'Inward', 'Gate Passes'],
  ['STORE', 'Store Movement', 'Gate Passes'],
  ['approvals', 'Pending Approvals', 'Approvals'],
  ['gate', 'Gate Entry / Exit', 'Security'],
  ['visitors', 'Visitor Register', 'Security'],
  ['weighbridge', 'Weighbridge', 'Store'],
  ['direct', 'Direct Gate Pass', 'Store'],
  ['masters', 'Master Data', 'Store'],
  ['reports', 'Reports & Export', 'Store'],
  ['audit', 'Audit Log', 'Admin'],
  ['users', 'User Management', 'Admin'],
  ['roles', 'Roles & Permissions', 'Admin'],
  ['analytics', 'Analytics', 'Admin'],
]

export const DEFAULT_PERMISSIONS = {
  requester: ['dashboard', 'NRGP', 'RGP', 'SCRAP', 'INWARD', 'STORE'],
  vendor: ['dashboard', 'INWARD'],
  approver: ['dashboard', 'approvals'],
  security: ['dashboard', 'gate', 'visitors'],
  store: ['dashboard', 'NRGP', 'RGP', 'SCRAP', 'INWARD', 'STORE', 'weighbridge', 'direct', 'masters', 'reports', 'gate'],
  admin: SCREENS.map((s) => s[0]),
}

/** Reference data every installation needs. Safe to run repeatedly. */
export async function seedReference(db) {
  for (const [code, name, desc] of ROLES)
    await db.query(`INSERT INTO roles (code, name, description) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`, [code, name, desc])
  for (const [i, [code, name, group]] of SCREENS.entries())
    await db.query(`INSERT INTO screens (code, name, group_name, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO UPDATE SET name = $2, group_name = $3, sort_order = $4`, [code, name, group, i])
  // Default permissions are only applied to roles that have none yet, so admin edits are never overwritten.
  for (const [role, screens] of Object.entries(DEFAULT_PERMISSIONS))
    await db.query(
      `INSERT INTO role_permissions (role_id, screen_code)
       SELECT r.id, s FROM roles r, unnest($2::text[]) s
       WHERE r.code = $1 AND NOT EXISTS (SELECT 1 FROM role_permissions p WHERE p.role_id = r.id)`,
      [role, screens],
    )
  for (const [code, name] of [['Nos', 'Numbers'], ['Kg', 'Kilograms'], ['Ltr', 'Litres'], ['Mtr', 'Metres'], ['Set', 'Set']])
    await db.query(`INSERT INTO uom (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [code, name])
  await db.query(`INSERT INTO weighbridges (name, location) VALUES ('Weighbridge 1', 'Gate 1') ON CONFLICT DO NOTHING`)
}

const roleId = async (db, code) => (await db.query('SELECT id FROM roles WHERE code = $1', [code])).rows[0].id

export async function createUser(db, { name, email, password, role, department, phone, vendorId }) {
  const hash = password ? await bcrypt.hash(password, 10) : null
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id, department, phone, vendor_id) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (lower(email)) DO NOTHING RETURNING id`,
    [name, email, hash, await roleId(db, role), department || null, phone || null, vendorId || null],
  )
  return rows[0]?.id
}

/** Sample masters and one user per role, for development / UAT walkthroughs. */
export async function seedDemo(db, password) {
  const vendors = [
    ['VEN-1001', 'Bharat Logistics Pvt Ltd', '36AABCB1234F1Z5', 'Kompally, Hyderabad', 'Ravi Teja', '9866010001', 'Transporter'],
    ['VEN-1002', 'Shree Engineering Works', '36AAFCS5678K1Z2', 'Balanagar, Hyderabad', 'Srinivas', '9866010002', 'Supplier'],
    ['VEN-1003', 'Om Sai Transport', '36AAHFO9012L1Z8', 'Gajwel, Siddipet', 'Mahesh', '9866010003', 'Transporter'],
    ['VEN-1004', 'Sri Shakti Biofuel', '36AAKCS3456M1Z1', 'Medak', 'Prasad', '9866010004', 'Logistics'],
    ['VEN-1005', 'Waste Ventures Pvt Ltd', '36AABCW2345P1Z7', 'Patancheru', 'Deepa', '9866010006', 'Logistics'],
    ['VEN-1006', 'Susheela Packaging', '36AAECS6789Q1Z3', 'Wargal', 'Naresh', '9866010007', 'Supplier'],
  ]
  for (const v of vendors)
    await db.query(`INSERT INTO vendors (code, name, gstin, address, contact_person, phone, vendor_type) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING`, v)

  const materials = [
    ['MAT-2001', 'Packaging Cartons - 5ply', '4819', 'Nos', 'Packaging', 85],
    ['MAT-2002', 'Shipper / Laminate Roll', '3920', 'Kg', 'Packaging', 240],
    ['MAT-2003', 'Mutton Tallow', '1502', 'Kg', 'Raw Material', 110],
    ['MAT-2004', 'Pedigree Adult 3kg (FG)', '2309', 'Nos', 'Finished Goods', 950],
    ['MAT-2005', 'Empty Pallets (Wooden)', '4415', 'Nos', 'Scrap', 150],
    ['MAT-2006', 'Gearbox Assembly - Extruder', '8483', 'Nos', 'Spares', 118000],
    ['MAT-2007', 'Motor 7.5HP', '8501', 'Nos', 'Spares', 42000],
    ['MAT-2008', 'Metal Scrap (MS)', '7204', 'Kg', 'Scrap', 32],
  ]
  for (const m of materials)
    await db.query(`INSERT INTO materials (code, description, hsn_code, uom_code, category, default_rate) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`, m)

  await db.query(`INSERT INTO contractors (code, name, firm_name, contact_person, phone, id_proof, valid_to) VALUES
    ('CON-3001','BIW Facility Services','BIW Pvt Ltd','Harish','9700030001','LIC/TS/2291','2027-03-31'),
    ('CON-3002','Swift Engineering','Swift Projects LLP','Arjun','9700030003','LIC/TS/3302','2026-12-31') ON CONFLICT (code) DO NOTHING`)
  await db.query(`INSERT INTO sub_contractors (code, name, parent_contractor_id, phone, valid_to)
    SELECT 'SUB-4001','GL Electricals', id, '9600040001', '2026-12-31' FROM contractors WHERE code = 'CON-3002' ON CONFLICT (code) DO NOTHING`)
  await db.query(`INSERT INTO service_vendors (code, name, service_type, phone, valid_to) VALUES
    ('SVC-5001','Sodexo Food Services','Canteen','9500050001','2027-06-30'),
    ('SVC-5002','G4S Secure Solutions','Security','9500050002','2027-01-31') ON CONFLICT (code) DO NOTHING`)

  const shree = (await db.query(`SELECT id FROM vendors WHERE code = 'VEN-1002'`)).rows[0].id
  const users = [
    ['Amit Sharma', 'amit.sharma@gpms.local', 'requester', 'Production'],
    ['Anita Mehta', 'anita.mehta@gpms.local', 'approver', 'Plant Operations'],
    ['Venkat Rao', 'venkat.rao@gpms.local', 'security', 'Security'],
    ['Rajesh Kumar', 'rajesh.kumar@gpms.local', 'store', 'Stores'],
    ['Shree Engineering Works', 'dispatch@shreeeng.local', 'vendor', 'Vendor', shree],
  ]
  for (const [name, email, role, department, vendorId] of users) await createUser(db, { name, email, password, role, department, vendorId })
  return users.map((u) => u[1])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const demo = process.argv.includes('--demo')
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gpms.local'
  const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url')
  const demoPassword = process.env.DEMO_PASSWORD || 'Demo@12345'
  tx(async (db) => {
    await seedReference(db)
    const created = await createUser(db, { name: 'Super Admin', email: adminEmail, password: adminPassword, role: 'admin', department: 'IT' })
    console.log('Reference data seeded')
    if (created) console.log(`Super Admin created: ${adminEmail}${process.env.ADMIN_PASSWORD ? '' : `  password: ${adminPassword}  (change it after first login)`}`)
    if (demo) {
      const emails = await seedDemo(db, demoPassword)
      console.log(`Demo data seeded. Demo users (password ${process.env.DEMO_PASSWORD ? 'from DEMO_PASSWORD' : demoPassword}):\n  ${emails.join('\n  ')}`)
    }
  })
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
