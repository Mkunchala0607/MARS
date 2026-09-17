import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, FileOutput, FileX, ShieldAlert, Undo2 } from 'lucide-react'
import { useApi } from '../api.js'
import { PASS_TYPES } from '../constants.js'
import { Badge, Card, Loading, PageHeader, Table, fmtDateTime } from '../components/ui.jsx'

const TYPES = [['NRGP', FileOutput], ['RGP', Undo2], ['SCRAP', FileX], ['INWARD', ArrowDownToLine], ['STORE', ArrowLeftRight]]

export default function Direct() {
  const navigate = useNavigate()
  const direct = useApi('/gate-passes?direct=true&limit=50')
  const deleted = useApi('/gate-passes?onlyDeleted=true&limit=50')

  return (
    <>
      <PageHeader crumbs={['Store', 'Direct Gate Pass']} title="Direct Gate Pass" subtitle="Elevated access for urgent or corrective cases. Bypasses approval; every action is audit-logged with a mandatory reason." />
      <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <ShieldAlert size={20} className="shrink-0" />
        Direct entries are flagged “Direct Entry” in every list and report. To delete a gate pass, open it and use Delete — deletions are soft deletes with a reason.
      </div>
      <Card title="Create directly">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TYPES.map(([t, Icon]) => (
            <button key={t} onClick={() => navigate(`/passes/${t}/new?direct=1`)} className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm font-medium hover:border-violet-400 hover:bg-violet-50/50">
              <Icon className="text-violet-600" size={20} /> {PASS_TYPES[t].short}
            </button>
          ))}
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recent direct entries" pad={false}>
          {!direct.data ? <Loading /> : (
            <Table
              rows={direct.data.data}
              empty="No direct entries yet"
              onRowClick={(p) => navigate(`/pass/${p.id}`)}
              columns={[
                { key: 'passNo', label: 'Pass No.', render: (p) => <span className="font-semibold">{p.passNo}</span> },
                { key: 'requester', label: 'Created by', render: (p) => p.requester.name },
                { key: 'createdAt', label: 'When', render: (p) => fmtDateTime(p.createdAt) },
                { key: 's', label: '', render: () => <Badge tone="Direct">Direct</Badge> },
              ]}
            />
          )}
        </Card>
        <Card title="Deleted gate passes" pad={false}>
          {!deleted.data ? <Loading /> : (
            <Table
              rows={deleted.data.data}
              empty="No deleted passes"
              onRowClick={(p) => navigate(`/pass/${p.id}`)}
              columns={[
                { key: 'passNo', label: 'Pass No.', render: (p) => <span className="font-semibold">{p.passNo}</span> },
                { key: 'deletedAt', label: 'Deleted', render: (p) => fmtDateTime(p.deletedAt) },
                { key: 'deleteReason', label: 'Reason' },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  )
}
