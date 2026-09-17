export const PASS_TYPES = {
  NRGP: { label: 'Non-Returnable Gate Pass', short: 'NRGP', direction: 'Outward' },
  RGP: { label: 'Returnable Gate Pass', short: 'RGP', direction: 'Outward' },
  SCRAP: { label: 'Scrap Outward', short: 'Scrap Outward', direction: 'Outward' },
  INWARD: { label: 'Inward Material', short: 'Inward', direction: 'Inward' },
  STORE: { label: 'Store Material Movement', short: 'Store Movement', direction: 'Internal' },
}

export const ROLE_LABELS = {
  requester: 'End User',
  vendor: 'Registered Person',
  approver: 'Approver',
  security: 'Security Officer',
  store: 'Store Person',
  admin: 'Super Admin',
}

export const GATE_STATUS_LABELS = {
  NotReady: '—',
  AwaitingGate: 'Awaiting Gate',
  Exited: 'Exited',
  Entered: 'Entered',
  Returned: 'Returned',
}

export const TIMELINE_LABELS = {
  Submitted: 'Submitted',
  Resubmitted: 'Amended & resubmitted',
  Approved: 'Approved',
  Rejected: 'Rejected',
  DirectEntry: 'Direct entry',
  Deleted: 'Deleted',
  GateExited: 'Exited at gate',
  GateEntered: 'Entered at gate',
  GateReturned: 'Returned (inward)',
  SealMismatch: 'Seal mismatch — vehicle held',
  Weighed: 'Weighed',
  CheckedIn: 'Checked in',
  CheckedOut: 'Checked out',
}

export const UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Set']
export const LOCATIONS = ['Ward A (Raw Material)', 'Ward B (Packing)', 'Ward C (Production)', 'FG Warehouse', 'Spares Store']
export const today = () => new Date().toISOString().slice(0, 10)
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
