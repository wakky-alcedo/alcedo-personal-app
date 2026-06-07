import React, { useEffect, useState } from 'react'
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

function LinkPreview({ url, title }: { url: string; title?: string | null }) {
  let host = url
  try { host = new URL(url).hostname } catch {}
  return (
    <div className="memo-link-preview">
      <span className="memo-link-icon">🔗</span>
      <div className="memo-link-text">
        <span className="memo-link-domain">{host}</span>
        {title && <span className="memo-link-title">{title}</span>}
      </div>
    </div>
  )
}

function MemoCard({
  memo,
  onEdit,
  onDelete,
}: {
  memo: Memo
  onEdit: () => void
  onDelete: () => void
}) {
  const url = memo.sourceUrl ?? extractUrl(memo.body)
  return (
    <div className="memo-card" onClick={onEdit} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onEdit()}>
      <div className="memo-body">{memo.body}</div>
      {url && <LinkPreview url={url} title={memo.sourceTitle} />}
      <div className="memo-footer">
        <button
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
  initialBody = '',
  sourceUrl,
  sourceTitle,
  onSave,
  onCancel,
  isEdit = false,
}: {
  initialBody?: string
  sourceUrl?: string | null
  sourceTitle?: string | null
  onSave: (body: string) => void
  onCancel: () => void
  isEdit?: boolean
}) {
  const [body, setBody] = useState(initialBody)
  return (
    <div className="memo-form-overlay" onClick={onCancel}>
      <div className="memo-form" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? 'メモを編集' : '新しいメモ'}</h3>
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
          <button type="button" className="btn-secondary" onClick={onCancel}>キャンセル</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { if (body.trim()) { onSave(body.trim()); } }}
            disabled={!body.trim()}
          >
            {isEdit ? '更新する' : 'メモを保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemosPage() {
  const { serverUrl, apiKey } = useAppConfig()
  const { showToast } = useToast()
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null)

  useEffect(() => { refresh() }, [serverUrl, apiKey])

  async function refresh() {
    setLoading(true)
    try {
      setMemos(await getMemos(serverUrl, apiKey))
    } catch {
      showToast('メモの取得に失敗しました', 'error')
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
      showToast('メモの保存に失敗しました', 'error')
    }
  }

  async function handleUpdate(id: string, body: string) {
    try {
      await updateMemo(serverUrl, apiKey, id, body)
      setMemos(prev => prev.map(m => m.id === id ? { ...m, body, updatedAt: new Date().toISOString() } : m))
      setEditingMemo(null)
    } catch {
      showToast('更新に失敗しました', 'error')
    }
  }

  async function handleDelete(memo: Memo) {
    if (!window.confirm('このメモを削除しますか？')) return
    try {
      await deleteMemo(serverUrl, apiKey, memo.id)
      setMemos(prev => prev.filter(m => m.id !== memo.id))
    } catch {
      showToast('削除に失敗しました', 'error')
    }
  }

  return (
    <main className="memos-page">
      <div className="memos-header">
        <h2>メモ</h2>
        <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>＋ 新規メモ</button>
      </div>

      {loading && <p className="loading-text">読み込み中...</p>}

      {!loading && memos.length === 0 && (
        <div className="memos-empty">
          <p className="memos-empty-icon">📝</p>
          <p>メモがまだありません</p>
          <p className="memos-empty-sub">記事を共有するか、＋から追加</p>
          <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>
            最初のメモを追加
          </button>
        </div>
      )}

      <div className="memo-list">
        {memos.map(memo => (
          <MemoCard
            key={memo.id}
            memo={memo}
            onEdit={() => setEditingMemo(memo)}
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

      {editingMemo && (
        <MemoForm
          initialBody={editingMemo.body}
          sourceUrl={editingMemo.sourceUrl}
          sourceTitle={editingMemo.sourceTitle}
          isEdit
          onSave={body => handleUpdate(editingMemo.id, body)}
          onCancel={() => setEditingMemo(null)}
        />
      )}
    </main>
  )
}
