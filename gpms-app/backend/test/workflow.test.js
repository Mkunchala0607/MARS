import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { futureDate, startTestApp } from './helpers.js'

let ctx, requester, approver, security, store, admin, vendorUser, vendors, materials

before(async () => {
  ctx = await startTestApp()
  ;[requester, approver, security, store, admin, vendorUser] = await Promise.all([
    ctx.login('amit.sharma@gpms.local'),
    ctx.login('anita.mehta@gpms.local'),
    ctx.login('venkat.rao@gpms.local'),
    ctx.login('rajesh.kumar@gpms.local'),
    ctx.login('admin@gpms.local', 'Admin@12345'),
    ctx.login('dispatch@shreeeng.local'),
  ])
  vendors = (await requester.get('/api/v1/masters/vendors')).body.data
  materials = (await requester.get('/api/v1/masters/materials')).body.data
})

after(() => ctx.stop())

const nrgp = (overrides = {}) => ({
  type: 'NRGP',
  vendorId: vendors[0].id,
  purpose: 'Motor sent for rewinding',
  vehicleNo: 'ts-09-xy-4321',
  sealNo: 'SEAL-7781',
  items: [{ materialId: materials[6].id, description: materials[6].description, uom: 'Nos', quantity: 2, approxValue: 84000 }],
  ...overrides,
})

describe('auth', () => {
  test('rejects wrong password with a generic message', async () => {
    const res = await ctx.api.post('/api/v1/auth/login').send({ email: 'amit.sharma@gpms.local', password: 'nope' })
    assert.equal(res.status, 401)
    assert.equal(res.body.error, 'Invalid email or password')
  })

  test('requires a token for protected routes', async () => {
    assert.equal((await ctx.api.get('/api/v1/gate-passes')).status, 401)
  })

  test('self-registration creates an inactive account that cannot log in until activated', async () => {
    const reg = await ctx.api.post('/api/v1/auth/register').send({ name: 'New Person', email: 'new.person@gpms.local', password: 'Passw0rd!' })
    assert.equal(reg.status, 201)
    const denied = await ctx.api.post('/api/v1/auth/login').send({ email: 'new.person@gpms.local', password: 'Passw0rd!' })
    assert.equal(denied.status, 401)
    const users = (await admin.get('/api/v1/users')).body.data
    const u = users.find((x) => x.email === 'new.person@gpms.local')
    assert.equal(u.isActive, false)
    assert.equal((await admin.patch(`/api/v1/users/${u.id}/active`, { isActive: true })).status, 200)
    assert.equal((await ctx.api.post('/api/v1/auth/login').send({ email: 'new.person@gpms.local', password: 'Passw0rd!' })).status, 200)
  })

  test('forgot + reset password flow', async () => {
    const res = await ctx.api.post('/api/v1/auth/forgot-password').send({ email: 'amit.sharma@gpms.local' })
    const token = new URL(res.headers['x-dev-reset-link'].replace('/#/', '/')).searchParams.get('token')
    assert.equal((await ctx.api.post('/api/v1/auth/reset-password').send({ token, password: 'Demo@12345' })).status, 200)
    // Tokens are single-use.
    assert.equal((await ctx.api.post('/api/v1/auth/reset-password').send({ token, password: 'Demo@12345' })).status, 400)
  })
})

describe('NRGP end-to-end: request → approval → gate exit → weighbridge', () => {
  let pass

  test('validation errors come back per field', async () => {
    const res = await requester.post('/api/v1/gate-passes', nrgp({ vehicleNo: 'bad', purpose: '', items: [{ description: '', uom: 'Nos', quantity: 0, approxValue: 1 }] }))
    assert.equal(res.status, 400)
    assert.ok(res.body.fields.vehicleNo)
    assert.ok(res.body.fields.purpose)
    assert.ok(res.body.fields['items.0.quantity'])
  })

  test('requester creates a pending NRGP with a sequential number', async () => {
    const res = await requester.post('/api/v1/gate-passes', nrgp())
    assert.equal(res.status, 201, JSON.stringify(res.body))
    pass = res.body
    assert.match(pass.passNo, /^NRGP-\d{4}-0001$/)
    assert.equal(pass.status, 'Pending')
    assert.equal(pass.vehicleNo, 'TS-09-XY-4321')
    assert.equal(pass.totalValue, 84000)
    assert.deepEqual(pass.timeline.map((t) => t.event), ['Submitted'])
    const notes = (await approver.get('/api/v1/notifications')).body
    assert.ok(notes.data.some((n) => n.message.includes(pass.passNo)))
  })

  test('security cannot let a pending pass out', async () => {
    const res = await security.post(`/api/v1/gate-passes/${pass.id}/gate`, { action: 'exit', sealNo: 'SEAL-7781' })
    assert.equal(res.status, 409)
  })

  test('requester cannot approve; approver must give remarks to reject', async () => {
    assert.equal((await requester.post(`/api/v1/gate-passes/${pass.id}/decision`, { decision: 'Approved' })).status, 403)
    const res = await approver.post(`/api/v1/gate-passes/${pass.id}/decision`, { decision: 'Rejected' })
    assert.equal(res.status, 400)
    assert.ok(res.body.fields.remarks)
  })

  test('reject → requester amends and resubmits → approve', async () => {
    const rej = await approver.post(`/api/v1/gate-passes/${pass.id}/decision`, { decision: 'Rejected', remarks: 'Add invoice number' })
    assert.equal(rej.body.status, 'Rejected')
    const amended = await requester.put(`/api/v1/gate-passes/${pass.id}`, nrgp({ invoiceNo: 'INV-2231' }))
    assert.equal(amended.status, 200, JSON.stringify(amended.body))
    assert.equal(amended.body.status, 'Pending')
    assert.equal(amended.body.invoiceNo, 'INV-2231')
    const ok = await approver.post(`/api/v1/gate-passes/${pass.id}/decision`, { decision: 'Approved' })
    assert.equal(ok.body.status, 'Approved')
    assert.equal(ok.body.gateStatus, 'AwaitingGate')
    assert.equal(ok.body.approvedBy, 'Anita Mehta')
    assert.deepEqual(ok.body.timeline.map((t) => t.event), ['Submitted', 'Rejected', 'Resubmitted', 'Approved'])
    // Double decisions are refused.
    assert.equal((await approver.post(`/api/v1/gate-passes/${pass.id}/decision`, { decision: 'Approved' })).status, 409)
  })

  test('gate lookup by vehicle number, seal mismatch holds the vehicle, correct seal allows exit', async () => {
    const found = await security.get('/api/v1/gate-passes/lookup?q=TS09XY4321')
    assert.equal(found.body.passNo, pass.passNo)
    const bad = await security.post(`/api/v1/gate-passes/${pass.id}/gate`, { action: 'exit', sealNo: 'SEAL-0000' })
    assert.equal(bad.status, 409)
    assert.match(bad.body.error, /Seal number does not match/)
    const exit = await security.post(`/api/v1/gate-passes/${pass.id}/gate`, { action: 'exit', sealNo: 'seal-7781' })
    assert.equal(exit.status, 200)
    assert.equal(exit.body.gateStatus, 'Exited')
    assert.ok(exit.body.timeline.some((t) => t.event === 'SealMismatch'))
    assert.equal((await security.post(`/api/v1/gate-passes/${pass.id}/gate`, { action: 'exit', sealNo: 'SEAL-7781' })).status, 409)
  })

  test('weighbridge computes net weight and requires approval', async () => {
    const bad = await store.post('/api/v1/weighbridge', { gatePassId: pass.id, slipNo: 'WB-1', inTime: new Date().toISOString(), grossWeight: 100, tareWeight: 200 })
    assert.equal(bad.status, 400)
    const res = await store.post('/api/v1/weighbridge', { gatePassId: pass.id, slipNo: 'WB-26-10301', inTime: new Date().toISOString(), grossWeight: 12450, tareWeight: 11900 })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.net, 550)
    assert.equal(res.body.status, 'Pending')
    const dec = await approver.post(`/api/v1/weighbridge/${res.body.id}/decision`, { decision: 'Approved' })
    assert.equal(dec.body.status, 'Approved')
    const full = await requester.get(`/api/v1/gate-passes/${pass.id}`)
    assert.equal(full.body.weighments[0].net, 550)
  })
})

describe('RGP return tracking', () => {
  test('expected date must be in the future; returned items are tracked', async () => {
    const past = await requester.post('/api/v1/gate-passes', nrgp({ type: 'RGP', sealNo: null, expectedReturnDate: '2020-01-01' }))
    assert.equal(past.status, 400)
    const rgp = (await requester.post('/api/v1/gate-passes', nrgp({ type: 'RGP', sealNo: null, expectedReturnDate: futureDate() }))).body
    assert.match(rgp.passNo, /^RGP-/)
    await approver.post(`/api/v1/gate-passes/${rgp.id}/decision`, { decision: 'Approved' })
    assert.equal((await security.post(`/api/v1/gate-passes/${rgp.id}/gate`, { action: 'return' })).status, 409)
    await security.post(`/api/v1/gate-passes/${rgp.id}/gate`, { action: 'exit' })
    const ret = await security.post(`/api/v1/gate-passes/${rgp.id}/gate`, { action: 'return', remarks: 'Received in good condition' })
    assert.equal(ret.body.gateStatus, 'Returned')
    assert.ok(ret.body.returnedAt)
  })
})

describe('role scoping and elevated access', () => {
  test('registered vendor can only raise Inward, always for their own company, and sees only their own passes', async () => {
    assert.equal((await vendorUser.post('/api/v1/gate-passes', nrgp())).status, 403)
    const inward = await vendorUser.post('/api/v1/gate-passes', {
      type: 'INWARD', vendorId: vendors[0].id, poNumber: 'PO-4500123981', vehicleNo: 'TS-08-CD-1122',
      items: [{ description: 'Conveyor rollers', uom: 'Nos', quantity: 40, approxValue: 64000 }],
    })
    assert.equal(inward.status, 201, JSON.stringify(inward.body))
    assert.equal(inward.body.vendor.name, 'Shree Engineering Works') // forced to own vendor, not vendors[0]
    const list = (await vendorUser.get('/api/v1/gate-passes')).body.data
    assert.ok(list.length >= 1 && list.every((p) => p.requester.id === vendorUser.user.id))
    const others = (await requester.get('/api/v1/gate-passes')).body.data
    assert.ok(others.every((p) => p.requester.id === requester.user.id))
    assert.equal((await requester.get(`/api/v1/gate-passes/${inward.body.id}`)).status, 404)
  })

  test('store movement needs from/to and never goes to the gate', async () => {
    const bad = await store.post('/api/v1/gate-passes', { type: 'STORE', fromLocation: 'Ward A', toLocation: 'Ward A', movementType: 'Issue', items: [{ description: 'Tallow', uom: 'Kg', quantity: 900, approxValue: 99000 }] })
    assert.equal(bad.status, 400)
    const ok = await store.post('/api/v1/gate-passes', { type: 'STORE', fromLocation: 'Ward A', toLocation: 'Ward C', movementType: 'Issue', items: [{ description: 'Tallow', uom: 'Kg', quantity: 900, approxValue: 99000 }] })
    assert.equal(ok.status, 201)
    const dec = await approver.post(`/api/v1/gate-passes/${ok.body.id}/decision`, { decision: 'Approved' })
    assert.equal(dec.body.gateStatus, 'NotReady')
  })

  test('direct entry: store person bypasses approval, audit logged; requester cannot', async () => {
    assert.equal((await requester.post('/api/v1/gate-passes', nrgp({ directReason: 'urgent' }))).status, 403)
    const res = await store.post('/api/v1/gate-passes', nrgp({ directReason: 'Urgent FG dispatch - approver on leave' }))
    assert.equal(res.status, 201)
    assert.equal(res.body.status, 'Approved')
    assert.equal(res.body.isDirectEntry, true)
    const auditLog = (await admin.get('/api/v1/audit')).body.data
    assert.ok(auditLog.some((a) => a.action === 'DIRECT_CREATE' && a.entityRef === res.body.passNo))
  })

  test('delete is soft, needs a reason, and blocks gate movement', async () => {
    const p = (await store.post('/api/v1/gate-passes', nrgp({ directReason: 'Correction entry', sealNo: null }))).body
    assert.equal((await store.del(`/api/v1/gate-passes/${p.id}`, {})).status, 400)
    assert.equal((await requester.del(`/api/v1/gate-passes/${p.id}`, { reason: 'x' })).status, 403)
    assert.equal((await store.del(`/api/v1/gate-passes/${p.id}`, { reason: 'Duplicate entry' })).status, 200)
    assert.equal((await security.post(`/api/v1/gate-passes/${p.id}/gate`, { action: 'exit' })).status, 409)
    const listed = (await store.get('/api/v1/gate-passes?onlyDeleted=true')).body.data
    assert.ok(listed.some((x) => x.id === p.id && x.deleteReason === 'Duplicate entry'))
  })

  test('bulk approve is all-or-nothing', async () => {
    const a = (await requester.post('/api/v1/gate-passes', nrgp({ sealNo: null }))).body
    const b = (await requester.post('/api/v1/gate-passes', nrgp({ sealNo: null }))).body
    await approver.post(`/api/v1/gate-passes/${b.id}/decision`, { decision: 'Approved' })
    assert.equal((await approver.post('/api/v1/gate-passes/decisions/bulk', { ids: [a.id, b.id] })).status, 409)
    assert.equal((await requester.get(`/api/v1/gate-passes/${a.id}`)).body.status, 'Pending')
    assert.equal((await approver.post('/api/v1/gate-passes/decisions/bulk', { ids: [a.id] })).status, 200)
  })

  test('permission changes take effect and are audited; admin cannot lock themselves out', async () => {
    const roles = (await admin.get('/api/v1/roles')).body
    assert.equal((await admin.put('/api/v1/roles/admin/permissions', { screens: ['dashboard'] })).status, 400)
    const withoutRgp = roles.permissions.requester.filter((s) => s !== 'RGP')
    assert.equal((await admin.put('/api/v1/roles/requester/permissions', { screens: withoutRgp })).status, 200)
    assert.equal((await requester.post('/api/v1/gate-passes', nrgp({ type: 'RGP', expectedReturnDate: futureDate() }))).status, 403)
    await admin.put('/api/v1/roles/requester/permissions', { screens: roles.permissions.requester })
    assert.ok((await admin.get('/api/v1/audit')).body.data.some((a) => a.action === 'PERMISSIONS_CHANGE'))
  })
})

describe('visitors', () => {
  const application = {
    name: 'Rahul Verma', contactNo: '9876543210', comingFrom: 'Audit Co', hostName: 'Anita Mehta',
    health: { skinDisease: false, eyeDisease: false, respiratoryDisease: true, allergies: false, typhoidHistory: false, details: 'Mild cough' },
    gmpAcknowledged: true, signatureName: 'Rahul Verma',
  }

  test('public application with health flag → approval → check-in/out', async () => {
    const noDetails = await ctx.api.post('/api/v1/public/visitors').send({ ...application, health: { ...application.health, details: '' } })
    assert.equal(noDetails.status, 400)
    const res = await ctx.api.post('/api/v1/public/visitors').send(application)
    assert.equal(res.status, 201)
    const status = await ctx.api.get(`/api/v1/public/visitors/${res.body.accessToken}`)
    assert.equal(status.body.status, 'Pending')

    const list = (await approver.get('/api/v1/visitors?status=Pending')).body.data
    const v = list.find((x) => x.passNo === res.body.passNo)
    assert.equal(v.health.hasFlag, true)
    assert.equal((await security.post(`/api/v1/visitors/${v.id}/check-in`)).status, 409) // not approved yet
    await approver.post(`/api/v1/visitors/${v.id}/decision`, { decision: 'Approved' })
    const inRes = await security.post(`/api/v1/visitors/${v.id}/check-in`)
    assert.ok(inRes.body.inTime)
    const outRes = await security.post(`/api/v1/visitors/${v.id}/check-out`)
    assert.ok(outRes.body.outTime)
    assert.equal((await ctx.api.get(`/api/v1/public/visitors/${res.body.accessToken}`)).body.status, 'Approved')
  })
})

describe('masters, reports, dashboards', () => {
  test('GSTIN validated, codes unique, only store/admin can edit', async () => {
    const bad = await store.post('/api/v1/masters/vendors', { code: 'VEN-9', name: 'X', gstin: '123', vendorType: 'Supplier' })
    assert.equal(bad.status, 400)
    const ok = await store.post('/api/v1/masters/vendors', { code: 'VEN-9', name: 'New Vendor', gstin: '36aabcn1234f1z5', vendorType: 'Supplier' })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.gstin, '36AABCN1234F1Z5')
    assert.equal((await store.post('/api/v1/masters/vendors', { code: 'VEN-9', name: 'Dup', vendorType: 'Supplier' })).status, 409)
    assert.equal((await requester.post('/api/v1/masters/vendors', { code: 'VEN-10', name: 'Nope', vendorType: 'Supplier' })).status, 403)
    await store.patch(`/api/v1/masters/vendors/${ok.body.id}/active`, { isActive: false })
    const inactive = await requester.post('/api/v1/gate-passes', nrgp({ vendorId: ok.body.id }))
    assert.equal(inactive.status, 400)
  })

  test('reports export JSON, CSV and XLSX', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const json = await store.get(`/api/v1/reports/gate-passes?from=${today}&to=${today}`)
    assert.equal(json.status, 200)
    assert.ok(json.body.rows.length > 0)
    const csv = await store.get(`/api/v1/reports/gate-passes?from=${today}&to=${today}&format=csv`)
    assert.match(csv.headers['content-type'], /text\/csv/)
    assert.match(csv.text, /Gate Pass No/)
    const xlsx = await store.get(`/api/v1/reports/visitors?from=${today}&to=${today}&format=xlsx`).buffer(true)
    assert.match(xlsx.headers['content-type'], /spreadsheetml/)
    assert.equal((await requester.get(`/api/v1/reports/gate-passes?from=${today}&to=${today}`)).status, 403)
  })

  test('dashboards are role aware', async () => {
    const personal = (await requester.get('/api/v1/dashboard')).body
    assert.equal(personal.kind, 'personal')
    assert.ok(personal.counts.total > 0)
    const ops = (await security.get('/api/v1/dashboard')).body
    assert.equal(ops.kind, 'operational')
    assert.equal(ops.activity.length, 7)
    const today = new Date().toISOString().slice(0, 10)
    const analytics = await admin.get(`/api/v1/dashboard/analytics?from=${today}&to=${today}`)
    assert.equal(analytics.status, 200)
    assert.ok(analytics.body.totals.passes > 0)
    assert.equal((await security.get(`/api/v1/dashboard/analytics?from=${today}&to=${today}`)).status, 403)
  })
})
