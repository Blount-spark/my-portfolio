import { useEffect, useState } from 'react'
import { makeGh } from '../lib/gh.js'
import { SITE_REPO } from '../data/config.js'
import TokenGate, { getAuth, setAuth, clearAuth } from './TokenGate.jsx'
import WorkList from './WorkList.jsx'
import WorkEditor from './WorkEditor.jsx'

export default function AdminApp() {
  const [auth, setAuthState] = useState(getAuth)
  const [site, setSite] = useState(null)
  const [sha, setSha] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | work 对象

  const gh = auth ? makeGh(auth) : null
  async function refresh() {
    if (!gh) return
    try {
      const r = await gh.getSite()
      setSite(r.site); setSha(r.sha); setError('')
    } catch (e) {
      if (e.code === 'bad_token' || e.code === 'no_access') { clearAuth(); setAuthState(null) }
      else setError('读取失败：' + e.code)
    }
  }
  useEffect(() => { refresh() }, [auth])

  if (!auth || !SITE_REPO.owner) return <TokenGate onDone={(a) => { setAuth(a); setAuthState(a) }} />
  if (editing !== null) return <WorkEditor gh={gh} site={site} sha={sha} auth={auth}
      work={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
      onSaved={async () => { await refresh(); setEditing(null) }} />

  return <WorkList gh={gh} site={site} error={error} auth={auth}
      onNew={() => setEditing('new')} onEdit={(w) => setEditing(w)}
      onReload={refresh} onLogout={() => { clearAuth(); setAuthState(null) }}
      onChanged={refresh} />
}
