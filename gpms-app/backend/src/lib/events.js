import nodemailer from 'nodemailer'
import { config } from '../config.js'

const transporter = config.smtp ? nodemailer.createTransport(config.smtp) : null

/** Append an approval-timeline event. Pass a transaction client when inside tx(). */
export function addTimeline(db, { entityType, entityId, event, actor, remarks }) {
  return db.query(
    `INSERT INTO approval_timeline (entity_type, entity_id, event, actor_id, actor_name, remarks) VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, event, actor?.id ?? null, actor?.name ?? 'Visitor', remarks || null],
  )
}

export function audit(db, { actor, action, entityType, entityRef, reason, details, ip }) {
  return db.query(
    `INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_ref, reason, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [actor.id, actor.name, action, entityType, entityRef, reason || null, details ? JSON.stringify(details) : null, ip || null],
  )
}

/** In-app notification for each user id; email is sent after commit via sendEmails(). */
export async function notify(db, userIds, message, link) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return []
  await db.query(
    `INSERT INTO notifications (user_id, message, link) SELECT unnest($1::bigint[]), $2, $3`,
    [ids, message, link || null],
  )
  const { rows } = await db.query(`SELECT email FROM users WHERE id = ANY($1::bigint[]) AND is_active`, [ids])
  return rows.map((r) => ({ to: r.email, subject: `GPMS: ${message}`, text: `${message}\n\n${config.appUrl}/#${link || '/'}` }))
}

export const approverIds = async (db) => (await db.query(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'approver' AND u.is_active`)).rows.map((r) => r.id)

/** Fire-and-forget email delivery. Without SMTP configured, emails are logged in development. */
export function sendEmails(mails) {
  for (const m of mails.flat()) {
    if (transporter) transporter.sendMail({ from: config.smtp.from, ...m }).catch((e) => console.error('Email failed:', e.message))
    else if (config.env === 'development') console.log(`[email] to=${m.to} subject="${m.subject}"`)
  }
}
