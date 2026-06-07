import React, { useState, useEffect } from 'react'
import { getMemos, createMemo, updateMemo, deleteMemo, type Memo } from '../api.ts'
import { useAppConfig } from '../contexts/AppConfigContext.tsx'
import { useToast } from '../contexts/ToastContext.tsx'

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3600000
    if (diffH < 1) return `${Math.floor(diffH * 60)}分前`
    if (diffH < 24) return `${Math.floor(diffH)}時間前`
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso.slice(0, 16)
  }
}

const URL_REGEX = /https?:\/\/[^\s.,;!?)'"`]+/g

function extractUrl(text: string): string | null {
  return text.match(URL_REGEX)?.[0] ?? null
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function LinkPreview({ url, title }: { url: string; title?: string | null }) {
  let host = url
  try { host = new URL(url).hostname } catch {}
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="memo-link-preview"
      onClick={e => e.stopPropagation()}
    >
      <span className="memo-link-icon">🔗</span>
      <div className="memo-link-text">
        <span className="memo-link-domain">{host}</span>
        {title && <span className="memo-link-title">{title}</span>}
      </div>
    </a>
  )
}

function MemoCard({
  memo,
  onSave,
  onDelete,
}: {
  memo: Memo
  onSave: (id: string, body: string) => Promise<void>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(memo.body)
  const { toast } = useToast()
  const url = memo.sourceUrl ?? extractUrl(memo.body)

  async function saveEdit() {
    const trimmed = body.trim()
    if (!trimmed || trimmed === memo.body) {
      setBody(memo.body)
      setEditing(false)
      return
    }
    try {
      await onSave(memo.id, trimmed)
      setEditing(false)
    } catch {
      toast.error('更新に失敗しました')
      setBody(memo.body)
      setEditing(false)
    }
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    const parts = [memo.body, memo.sourceTitle, memo.sourceUrl].filter(Boolean)
    try {
      await navigator.clipboard.writeText(parts.join('\n'))
      toast.success('コピーしました')
    } catch {
      toast.error('コピーに失敗しました')
    }
  }

  return (
    <div className={`memo-card${editing ? ' memo-card--editing' : ''}`}>
      <div className="memo-card-header">
        <button className="memo-copy-btn" type="button" onClick={handleCopy} title="コピー">
          <CopyIcon />
        </button>
      </div>
      {editing ? (
        <textarea
          className="memo-textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setBody(memo.body); setEditing(false) }
          }}
          autoFocus
        />
      ) : (
        <div
          className="memo-body"
          onClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setEditing(true)}
        >
          {memo.body}
        </div>
      )}
      {!editing && url && <LinkPreview url={url} title={memo.sourceTitle} />}
      <div className="memo-footer">
        <button
          type="button"
          className="memo-delete-btn"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="削除"
        >✕</button>
        <span className="memo-date">{formatDate(memo.createdAt)}</span>
      </div>
    </div>
  )
}

function MemoForm({
  sourceUrl,
  sourceTitle,
  onSave,
  onCancel,
}: {
  sourceUrl?: string | null
  sourceTitle?: string | null
  onSave: (body: string) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  return (
    <div className="memo-form-overlay" onClick={onCancel}>
      <div className="memo-form" onClick={e => e.stopPropagation()}>
        <h3>新しいメモ</h3>
        {sourceUrl && <LinkPreview url={sourceUrl} title={sourceTitle} />}
        <textarea
          className="memo-textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="コメントを入力..."
          autoFocus
          rows={5}
        />
        <div className="memo-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { if (body.trim()) { onSave(body.trim()); } }}
            disabled={!body.trim()}
          >
            メモを保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemosPage() {
  const { serverUrl, apiKey } = useAppConfig()
  const { toast } = useToast()
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { refresh() }, [serverUrl, apiKey])

  async function refresh() {
    setLoading(true)
    try {
      setMemos(await getMemos(serverUrl, apiKey))
    } catch {
      toast.error('メモの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(body: string) {
    try {
      await createMemo(serverUrl, apiKey, body)
      await refresh()
      setShowNew(false)
    } catch {
      toast.error('メモの保存に失敗しました')
    }
  }

  async function handleUpdate(id: string, body: string) {
    await updateMemo(serverUrl, apiKey, id, body)
    setMemos(prev => prev.map(m => m.id === id ? { ...m, body, updatedAt: new Date().toISOString() } : m))
  }

  async function handleDelete(memo: Memo) {
    if (!window.confirm('このメモを削除しますか？')) return
    try {
      await deleteMemo(serverUrl, apiKey, memo.id)
      setMemos(prev => prev.filter(m => m.id !== memo.id))
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <main className="memos-page">
      <div className="memos-header">
        <h2>メモ</h2>
        <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>＋ 新規メモ</button>
      </div>

      {loading && <p className="loading-text">読み込み中...</p>}

      {!loading && memos.length === 0 && (
        <div className="memos-empty">
          <p className="memos-empty-icon">📝</p>
          <p>メモがまだありません</p>
          <p className="memos-empty-sub">記事を共有するか、＋から追加</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
            最初のメモを追加
          </button>
        </div>
      )}

      <div className="memo-list">
        {memos.map(memo => (
          <MemoCard
            key={memo.id}
            memo={memo}
            onSave={handleUpdate}
            onDelete={() => handleDelete(memo)}
          />
        ))}
      </div>

      {showNew && (
        <MemoForm
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}
    </main>
  )
}
