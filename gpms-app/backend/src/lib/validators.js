import { z } from 'zod'
import { notFound } from './http.js'

export const PASS_TYPES = {
  NRGP: { prefix: 'NRGP', label: 'Non-Returnable Gate Pass', direction: 'Outward' },
  RGP: { prefix: 'RGP', label: 'Returnable Gate Pass', direction: 'Outward' },
  SCRAP: { prefix: 'SCR', label: 'Scrap Outward', direction: 'Outward' },
  INWARD: { prefix: 'INW', label: 'Inward Material', direction: 'Inward' },
  STORE: { prefix: 'STM', label: 'Store Material Movement', direction: 'Internal' },
}

export const idParam = (value) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw notFound()
  return n
}

const trimmed = (max = 500) => z.string().trim().max(max)
const optText = (max = 500) => trimmed(max).optional().nullable().transform((v) => (v ? v : null))
const reqText = (label, max = 500) => trimmed(max).min(1, `${label} is required`)

// Indian registration plates: TS-12-AB-3345, TS12AB3345, KA-01-1234 ...
export const VEHICLE_RE = /^[A-Z]{2}-?\d{1,2}-?[A-Z]{0,3}-?\d{3,4}$/
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/
export const normaliseVehicle = (v) => v.trim().toUpperCase()

const itemSchema = z.object({
  materialId: z.coerce.number().int().positive().optional().nullable(),
  description: reqText('Description', 300),
  uom: z.enum(['Nos', 'Kg', 'Ltr', 'Mtr', 'Set'], { message: 'Invalid unit' }),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  approxValue: z.coerce.number().min(0, 'Value cannot be negative'),
  remarks: optText(300),
})

export const gatePassSchema = z
  .object({
    type: z.enum(Object.keys(PASS_TYPES)),
    vendorId: z.coerce.number().int().positive().optional().nullable(),
    purpose: optText(500),
    despatchedThrough: optText(200),
    lrRrNo: optText(100),
    freightTerms: z.enum(['Paid', 'To Pay']).optional().nullable(),
    freightAmount: z.coerce.number().min(0).optional().nullable(),
    insurance: z.enum(['Arranged', 'To be arranged']).optional().nullable(),
    noOfPackages: z.coerce.number().int().min(0).optional().nullable(),
    poNumber: optText(100),
    inwardDate: z.iso.date().optional().nullable(),
    expectedReturnDate: z.iso.date().optional().nullable(),
    fromLocation: optText(100),
    toLocation: optText(100),
    movementType: z.enum(['Issue', 'Transfer', 'Return to Store']).optional().nullable(),
    vehicleNo: optText(20),
    driverName: optText(100),
    invoiceNo: optText(100),
    sealNo: optText(50),
    items: z.array(itemSchema).min(1, 'At least one item is required').max(50),
    directReason: optText(500),
  })
  .superRefine((d, ctx) => {
    const err = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (d.type !== 'STORE' && !d.vendorId) err('vendorId', 'Party is required')
    if (['NRGP', 'RGP', 'SCRAP'].includes(d.type) && !d.purpose) err('purpose', 'Purpose is required')
    if (d.type === 'INWARD' && !d.poNumber) err('poNumber', 'PO / reference number is required')
    if (d.type === 'RGP') {
      if (!d.expectedReturnDate) err('expectedReturnDate', 'Expected return date is required')
      else if (d.expectedReturnDate <= new Date().toISOString().slice(0, 10)) err('expectedReturnDate', 'Expected return date must be in the future')
    }
    if (d.type === 'STORE') {
      if (!d.fromLocation) err('fromLocation', 'From location is required')
      if (!d.toLocation) err('toLocation', 'To location is required')
      if (d.fromLocation && d.fromLocation === d.toLocation) err('toLocation', 'From and To must differ')
      if (!d.movementType) err('movementType', 'Movement type is required')
    }
    if (d.type !== 'STORE') {
      if (!d.vehicleNo) err('vehicleNo', 'Vehicle number is required')
      else if (!VEHICLE_RE.test(normaliseVehicle(d.vehicleNo))) err('vehicleNo', 'Vehicle number format e.g. TS-12-AB-3345')
    }
  })

export const listQuerySchema = z.object({
  type: z.enum(Object.keys(PASS_TYPES)).optional(),
  status: z.enum(['Pending', 'Approved', 'Rejected']).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
  onlyDeleted: z.enum(['true', 'false']).optional(),
  direct: z.enum(['true', 'false']).optional(),
  gateStatus: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const decisionSchema = z
  .object({ decision: z.enum(['Approved', 'Rejected']), remarks: optText(500) })
  .refine((d) => d.decision === 'Approved' || d.remarks, { path: ['remarks'], message: 'Remarks are required to reject' })

export const reasonSchema = z.object({ reason: reqText('Reason', 500) })

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')

export { z, optText, reqText }
