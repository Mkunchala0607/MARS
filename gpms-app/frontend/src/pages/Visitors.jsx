import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api, qs, useApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Badge, Button, Card, ErrorState, Loading, Modal, PageHeader, Table, Tabs, fmtDateTime } from '../components/ui.jsx'

export default function Visitors() {
  const { toast } = useAuth()
  const [tab, setTab] = useState('All')
  const [qr, setQr] = useState(false)
  const list = useApi(`/visitors${qs({ status: ['Pending', 'Approved', 'Rejected'].includes(tab) ? tab : '', inside: tab === 'Inside' ? 'true' : '' })}`)
  const link = `${location.origin}${location.pathname}#/visitor-pass`

  const move = async (v, action) => {
    try {
      await api.post(`/visitors/${v.id}/${action}`)
      toast(`${v.name} ${action === 'check-in' ? 'checked in' : 'checked out'}`)
      list.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        crumbs={['Security', 'Visitor Register']}
        title="Visitor Register"
        subtitle="Digital Visitor Entry Register and FORM-1839 health declarations."
        actions={<><Button tone="secondary" icon={QrCode} onClick={() => setQr(true)}>Gate QR for visitors</Button><Button to="/visitor-pass">New walk-in visitor</Button></>}
      />
      <Card pad={false}>
        <div className="px-5 pt-1">
          <Tabs value={tab} onChange={setTab} tabs={['All', 'Pending', 'Approved', 'Inside', 'Rejected'].map((t) => ({ value: t, label: t }))} />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : (
          <Table
            rows={list.data.data}
            columns={[
              { key: 'passNo', label: 'Pass No.', render: (v) => <span className="font-semibold">{v.passNo}</span> },
              { key: 'name', label: 'Name', render: (v) => <div>{v.name}<div className="text-xs text-slate-400">{v.contactNo}</div></div> },
              { key: 'comingFrom', label: 'Coming From' },
              { key: 'hostName', label: 'Whom to Meet' },
              { key: 'laptopDetails', label: 'Laptop', render: (v) => v.laptopDetails || '—' },
              { key: 'health', label: 'Health', render: (v) => (v.health.hasFlag ? <Badge tone="Rejected">Declared</Badge> : <Badge tone="Approved">Clear</Badge>) },
              { key: 'status', label: 'Status', render: (v) => <Badge>{v.status}</Badge> },
              { key: 'inTime', label: 'In', render: (v) => fmtDateTime(v.inTime), className: 'whitespace-nowrap' },
              { key: 'outTime', label: 'Out', render: (v) => fmtDateTime(v.outTime), className: 'whitespace-nowrap' },
              {
                key: 'act',
                label: '',
                render: (v) =>
                  v.status === 'Approved' && !v.inTime ? (
                    <Button size="sm" icon={LogIn} onClick={() => move(v, 'check-in')}>Check in</Button>
                  ) : v.inTime && !v.outTime ? (
                    <Button size="sm" tone="secondary" icon={LogOut} onClick={() => move(v, 'check-out')}>Check out</Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
      <Modal open={qr} title="Visitor self-registration QR" onClose={() => setQr(false)}>
        <div className="text-center">
          <QRCodeSVG value={link} size={200} className="mx-auto" />
          <p className="mt-4 text-sm text-slate-600">Print and place this at the visitor gate. Visitors scan it to fill the entry form and health declaration on their phone.</p>
          <p className="mt-2 text-xs break-all text-slate-400">{link}</p>
          <Link to="/visitor-pass" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Open visitor form</Link>
        </div>
      </Modal>
    </>
  )
}
