const Database = require('better-sqlite3')
const path = require('node:path')
const fs = require('node:fs')

const dataDir = path.resolve(process.cwd(), 'pc-server', 'data')
const dbPath = path.join(dataDir, 'app.sqlite')
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath)
  process.exit(1)
}

const db = new Database(dbPath)

function normalizeSubtasks(subtasks) {
  if (!subtasks) return []
  if (typeof subtasks === 'string') {
    try { return JSON.parse(subtasks) } catch { return [] }
  }
  if (!Array.isArray(subtasks)) return []
  return subtasks
}

function* flattenSubtasks(parentTask, nodes, parentId) {
  for (const node of nodes) {
    const id = node.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const row = {
      id,
      title: node.title ?? '',
      description: node.description ?? null,
      categoryType: parentTask.categoryType ?? 'short_term',
      categoryName: parentTask.categoryName ?? 'default',
      priority: node.priority ?? parentTask.priority ?? 'low',
      dueAt: node.dueAt ?? null,
      status: node.status === 'todo' || node.status === 'doing' || node.status === 'done' ? node.status : (node.done ? 'done' : 'todo'),
      subtasks: JSON.stringify(node.subtasks ?? []),
      parentId: parentId,
      updatedAt: new Date().toISOString(),
      version: 1,
    }
    yield row
    const children = normalizeSubtasks(node.subtasks)
    if (children.length > 0) {
      yield* flattenSubtasks(parentTask, children, id)
    }
  }
}

const selectAll = db.prepare('SELECT * FROM tasks')
const insert = db.prepare(`INSERT OR IGNORE INTO tasks (id, title, description, categoryType, categoryName, priority, dueAt, status, subtasks, parentId, deletedAt, updatedAt, version) VALUES (@id, @title, @description, @categoryType, @categoryName, @priority, @dueAt, @status, @subtasks, @parentId, NULL, @updatedAt, @version)`)
const updateParent = db.prepare('UPDATE tasks SET subtasks = ? WHERE id = ?')

const rows = selectAll.all()
let inserted = 0
let convertedParents = 0

const tx = db.transaction(() => {
  for (const row of rows) {
    const subtasks = normalizeSubtasks(row.subtasks)
    if (!subtasks || subtasks.length === 0) continue
    for (const child of flattenSubtasks(row, subtasks, row.id)) {
      insert.run(child)
      inserted++
    }
    updateParent.run('[]', row.id)
    convertedParents++
  }
})

console.log('Converting subtasks to rows...')
try {
  tx()
  console.log(`Converted ${convertedParents} parent tasks, inserted ${inserted} child rows.`)
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(2)
}

console.log('Migration complete. Please review data and update server logic to use parentId.')
