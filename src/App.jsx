import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'oasis-scorepro.field-tasks'

const PRIORITIES = ['Low', 'Medium', 'High']

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('Medium')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const score = useMemo(() => {
    if (tasks.length === 0) return 0
    const done = tasks.filter((t) => t.done).length
    return Math.round((done / tasks.length) * 100)
  }, [tasks])

  function addTask(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTasks((prev) => [
      { id: `${prev.length}-${trimmed}-${prev.reduce((n, t) => n + t.id.length, 0)}`, title: trimmed, priority, done: false },
      ...prev,
    ])
    setTitle('')
    setPriority('Medium')
  }

  function toggleTask(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Field Task ScorePro</h1>
        <div className="score" aria-label="Completion score">
          <span className="score-value">{score}</span>
          <span className="score-unit">%</span>
        </div>
      </header>

      <form className="task-form" onSubmit={addTask}>
        <input
          className="task-input"
          type="text"
          placeholder="Describe a field task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="task-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button className="task-add" type="submit">
          Add Task
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="empty">No field tasks yet. Add one to get started.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task ${task.done ? 'task--done' : ''}`}>
              <label className="task-main">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="task-title">{task.title}</span>
              </label>
              <span className={`badge badge--${task.priority.toLowerCase()}`}>
                {task.priority}
              </span>
              <button
                className="task-remove"
                type="button"
                onClick={() => removeTask(task.id)}
                aria-label={`Remove ${task.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="footer">
        {tasks.filter((t) => t.done).length} of {tasks.length} tasks complete
      </footer>
    </main>
  )
}

export default App
