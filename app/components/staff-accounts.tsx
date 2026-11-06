"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./staff-accounts.module.css";

type Role = "admin" | "campaign_manager" | "viewer";
export type StaffAccount = { id?: string; username: string; name: string; role: Role; active: boolean; businessRole?: string; mustChangePassword?: boolean };
type AccountInput = { username: string; name: string; role: Role; active: boolean; password?: string };
const emptyAccount = (): StaffAccount => ({ username: "", name: "", role: "viewer", active: false });
const roleLabels: Record<Role, string> = { admin: "Administrator", campaign_manager: "Campaign manager", viewer: "Viewer" };

export default function StaffAccounts({ users, currentUserId, onSave }: { users: StaffAccount[]; currentUserId: string; onSave: (input: AccountInput) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [edit, setEdit] = useState<StaffAccount>(emptyAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const original = users.find(account => account.id === edit.id);
  const self = Boolean(edit.id && edit.id === currentUserId);
  const passwordRequired = !edit.id || (original?.active === false && edit.active);
  const open = (account: StaffAccount) => { setEdit({ ...account }); setEditorVersion(value => value + 1); setError(""); setShowPassword(false); dialog.current?.showModal(); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      await onSave({ username: String(fields.get("username") || "").trim(), name: String(fields.get("name") || "").trim(), role: edit.role, active: edit.active, password: String(fields.get("password") || "") || undefined });
      dialog.current?.close();
    } catch (failure) { setError((failure as Error).message || "The account could not be saved."); }
    finally { setSaving(false); }
  }
  return <section className="panel">
    <div className={styles.heading}><div><h2>Staff accounts and permissions</h2><p>Disabled accounts cannot sign in. To activate someone, set a temporary password, choose their permission and enable access.</p></div><button className="btn btn-primary" type="button" disabled={saving} onClick={() => open(emptyAccount())}>New account</button></div>
    <div className="table-container"><table><thead><tr><th>NAME</th><th>USERNAME</th><th>ROLE</th><th>ACCESS</th><th><span className={styles.srOnly}>Account actions</span></th></tr></thead><tbody>{users.map(account => <tr key={account.id}><td><strong>{account.name}</strong><small className={styles.secondary}>{account.businessRole}</small></td><td>{account.username}</td><td>{roleLabels[account.role]}</td><td><span className={`badge ${account.active ? "badge-green" : "badge-amber"}`}>{account.active ? "Active" : "Disabled"}</span>{account.active && account.mustChangePassword && <small className={styles.secondary}>Password change required</small>}</td><td><button type="button" className="text-button" disabled={saving} aria-label={`Manage ${account.name}`} onClick={() => open(account)}>Manage</button></td></tr>)}</tbody></table></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="staff-account-heading" onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>STAFF ACCESS</p><h2 id="staff-account-heading">{edit.id ? `Manage ${edit.name}` : "Create staff account"}</h2></div><button type="button" className="btn btn-secondary" aria-label="Close account editor" disabled={saving} onClick={() => dialog.current?.close()}>×</button></div>
      <p>{original?.active ? "Update permissions, disable access or reset the password." : "This person cannot sign in until you enable access and set a temporary password."}</p>
      <form key={`${edit.id || "new"}:${editorVersion}`} onSubmit={submit} className={styles.form}>
        <label>Name<input name="name" defaultValue={edit.name} maxLength={120} required /></label>
        <label>Login username<input name="username" defaultValue={edit.username} readOnly={Boolean(edit.id)} autoComplete="off" pattern="[a-z0-9][a-z0-9.@_\-]{2,99}" required /><small>Use this username on the Staff / Admin sign-in form.</small></label>
        <label>Permission<select name="role" value={edit.role} disabled={self} onChange={event => setEdit({ ...edit, role: event.target.value as Role })}><option value="viewer">Viewer · read only</option><option value="campaign_manager">Campaign manager · audiences, campaigns and recovery</option><option value="admin">Administrator · all settings and accounts</option></select></label>
        <label className={styles.check}><input name="active" type="checkbox" checked={edit.active} disabled={self} onChange={event => setEdit({ ...edit, active: event.target.checked })} /><span>Enable this person’s access</span></label>
        {self && <small>You cannot disable or demote your own administrator account.</small>}
        <label>Temporary password{passwordRequired ? " · required" : " · optional reset"}<input name="password" type={showPassword ? "text" : "password"} minLength={12} maxLength={256} autoComplete="new-password" required={passwordRequired} placeholder={passwordRequired ? "At least 12 characters" : "Leave blank to keep the current password"} /></label>
        <label className={styles.check}><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /><span>Show temporary password</span></label>
        <p className={styles.help}>Share temporary passwords privately. A new or reset password must be changed at first sign-in. Saving an existing account signs out its current sessions.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving account…" : "Save account"}</button></div>
      </form>
    </dialog>
  </section>;
}
