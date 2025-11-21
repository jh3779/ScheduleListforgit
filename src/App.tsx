import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Priority = 'high' | 'medium' | 'low'

interface Task {
  id: string
  title: string
  description: string
  dueDate: string
  categoryId: string
  priority: Priority
  completed: boolean
  createdAt: string
  plannedMinutes: number
  loggedSeconds: number
}

interface Category {
  id: string
  name: string
  color: string
}

interface Goal {
  id: string
  title: string
  targetCount: number
  targetMinutes: number
  period: 'weekly' | 'monthly'
}

const STORAGE_KEY = 'study-schedule-state-v1'
const priorityLabel: Record<Priority, string> = {
  high: '상',
  medium: '중',
  low: '하',
}

const fallbackCategories: Category[] = [
  { id: 'cat-all', name: '전체', color: '#6c63ff' },
  { id: 'cat-math', name: '수학', color: '#ff6b6b' },
  { id: 'cat-eng', name: '영어', color: '#1dd1a1' },
]

const fallbackGoals: Goal[] = [
  {
    id: 'goal-week',
    title: '이번 주 최소 10개 완료',
    period: 'weekly',
    targetCount: 10,
    targetMinutes: 300,
  },
]

function App() {
  const safeParse = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }

  const initialData = safeParse()

  const [tasks, setTasks] = useState<Task[]>(initialData?.tasks ?? [])
  const [categories, setCategories] = useState<Category[]>(
    initialData?.categories ?? fallbackCategories,
  )
  const [goals, setGoals] = useState<Goal[]>(initialData?.goals ?? fallbackGoals)
  const [theme, setTheme] = useState<'light' | 'dark'>(initialData?.theme ?? 'light')
  const [taskForm, setTaskForm] = useState({
    id: '',
    title: '',
    description: '',
    dueDate: '',
    categoryId: categories[0]?.id ?? 'cat-all',
    priority: 'medium' as Priority,
    plannedMinutes: 60,
  })
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'month'>('list')
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortOption, setSortOption] = useState<'due' | 'priority' | 'latest'>('due')
  const [autoSort, setAutoSort] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [goalForm, setGoalForm] = useState({
    title: '',
    targetCount: 5,
    targetMinutes: 300,
    period: 'weekly' as Goal['period'],
  })
  const [timerTaskId, setTimerTaskId] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks, categories, goals, theme }),
    )
  }, [tasks, categories, goals, theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning])

  const todayISO = new Date().toISOString().split('T')[0]

  const sortedTasks = useMemo(() => {
    const data = [...tasks]
    if (!autoSort && sortOption === 'latest') {
      return data
    }
    return data.sort((a, b) => {
      if (sortOption === 'due') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (sortOption === 'priority') {
        const order: Priority[] = ['high', 'medium', 'low']
        return order.indexOf(a.priority) - order.indexOf(b.priority)
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [tasks, sortOption, autoSort])

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter((task) => {
      if (showTodayOnly && task.dueDate !== todayISO) return false
      if (categoryFilter !== 'all' && task.categoryId !== categoryFilter) return false
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      return true
    })
  }, [sortedTasks, showTodayOnly, todayISO, categoryFilter, searchTerm])

  const weeklyBuckets = useMemo(() => {
    const start = getStartOfWeek(new Date())
    const buckets: Record<string, Task[]> = {}
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      const key = day.toISOString().split('T')[0]
      buckets[key] = []
    }
    tasks.forEach((task) => {
      if (buckets[task.dueDate]) {
        buckets[task.dueDate].push(task)
      }
    })
    return buckets
  }, [tasks])

  const monthlyMatrix = useMemo(() => {
    const base = new Date()
    base.setDate(1)
    const firstDay = base.getDay()
    const totalDays = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    const matrix: { date: string | null; tasks: Task[] }[] = []
    for (let i = 0; i < firstDay; i += 1) {
      matrix.push({ date: null, tasks: [] })
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const dateObj = new Date(base.getFullYear(), base.getMonth(), day)
      const key = dateObj.toISOString().split('T')[0]
      matrix.push({
        date: key,
        tasks: tasks.filter((task) => task.dueDate === key),
      })
    }
    return matrix
  }, [tasks])

  const completionRate =
    tasks.length === 0
      ? 0
      : Math.round(
          (tasks.filter((task) => task.completed).length / tasks.length) * 100,
        )

  const totalLoggedMinutes = Math.round(
    tasks.reduce((sum, task) => sum + task.loggedSeconds, 0) / 60,
  )

  const priorityStats = useMemo(() => {
    return ['high', 'medium', 'low'].map((level) => ({
      level,
      count: tasks.filter((task) => task.priority === level).length,
    }))
  }, [tasks])

  function getStartOfWeek(date: Date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  const resetTaskForm = () => {
    setTaskForm({
      id: '',
      title: '',
      description: '',
      dueDate: '',
      categoryId: categories[0]?.id ?? 'cat-all',
      priority: 'medium',
      plannedMinutes: 60,
    })
  }

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title || !taskForm.dueDate) return
    if (taskForm.id) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskForm.id
            ? {
                ...task,
                title: taskForm.title,
                description: taskForm.description,
                dueDate: taskForm.dueDate,
                categoryId: taskForm.categoryId,
                priority: taskForm.priority,
                plannedMinutes: taskForm.plannedMinutes,
              }
            : task,
        ),
      )
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: taskForm.title,
          description: taskForm.description,
          dueDate: taskForm.dueDate,
          categoryId: taskForm.categoryId,
          priority: taskForm.priority,
          completed: false,
          createdAt: new Date().toISOString(),
          plannedMinutes: taskForm.plannedMinutes,
          loggedSeconds: 0,
        },
      ])
    }
    resetTaskForm()
  }

  const handleEditTask = (task: Task) => {
    setTaskForm({
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      categoryId: task.categoryId,
      priority: task.priority,
      plannedMinutes: task.plannedMinutes,
    })
  }

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  const toggleCompletion = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  const addCategory = () => {
    const name = prompt('새 과목/카테고리 이름을 입력하세요.')
    if (!name) return
    const color = `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0')}`
    setCategories((prev) => [...prev, { id: crypto.randomUUID(), name, color }])
  }

  const removeCategory = (id: string) => {
    if (!confirm('카테고리를 삭제하면 연결된 일정은 "전체"로 이동합니다.')) return
    setTasks((prev) =>
      prev.map((task) =>
        task.categoryId === id ? { ...task, categoryId: categories[0]?.id ?? 'cat-all' } : task,
      ),
    )
    setCategories((prev) => prev.filter((cat) => cat.id !== id))
  }

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalForm.title) return
    setGoals((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: goalForm.title,
        targetCount: goalForm.targetCount,
        targetMinutes: goalForm.targetMinutes,
        period: goalForm.period,
      },
    ])
    setGoalForm({
      title: '',
      targetCount: 5,
      targetMinutes: 300,
      period: 'weekly',
    })
  }

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((goal) => goal.id !== id))
  }

  const handleTimerStart = () => {
    if (!timerTaskId) return
    setTimerRunning(true)
  }

  const handleTimerStop = () => {
    setTimerRunning(false)
    if (!timerTaskId || timerSeconds === 0) return
    setTasks((prev) =>
      prev.map((task) =>
        task.id === timerTaskId
          ? { ...task, loggedSeconds: task.loggedSeconds + timerSeconds }
          : task,
      ),
    )
    setTimerSeconds(0)
  }

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ tasks, categories, goals, theme }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'schedule-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (parsed.tasks) setTasks(parsed.tasks)
        if (parsed.categories) setCategories(parsed.categories)
        if (parsed.goals) setGoals(parsed.goals)
        if (parsed.theme) setTheme(parsed.theme)
      } catch {
        alert('JSON을 읽을 수 없습니다.')
      }
    }
    reader.readAsText(file)
  }

  const doneCount = tasks.filter((task) => task.completed).length

  return (
    <div className="app-shell">
      <header className="app-header">
      <div>
          <p className="today-label">{todayISO}</p>
          <h1>공부 일정 관리</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '다크 모드' : '라이트 모드'}
          </button>
          <button className="ghost" onClick={handleExport}>
            백업(JSON)
          </button>
          <label className="ghost file-input">
            불러오기
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <p>완료율</p>
          <h2>{completionRate}%</h2>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${completionRate}%` }} />
          </div>
        </article>
        <article className="metric-card">
          <p>총 일정</p>
          <h2>
            {doneCount}/{tasks.length}
          </h2>
          <small>완료 / 전체</small>
        </article>
        <article className="metric-card">
          <p>누적 공부 시간</p>
          <h2>{totalLoggedMinutes}분</h2>
        </article>
        <article className="metric-card">
          <p>우선순위 분포</p>
          <div className="priority-bars">
            {priorityStats.map((stat) => (
              <div key={stat.level}>
                <span>{priorityLabel[stat.level as Priority]}</span>
                <div className="progress">
                  <div
                    className={`progress-bar ${stat.level}`}
                    style={{
                      width: tasks.length
                        ? `${(stat.count / tasks.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panels-grid">
        <article className="panel">
          <h2>일정 {taskForm.id ? '수정' : '추가'}</h2>
          <form className="task-form" onSubmit={handleSubmitTask}>
            <label>
              제목
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="예: 미적분 과제"
                required
              />
            </label>
            <label>
              설명
              <textarea
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
                placeholder="세부 내용을 적어주세요."
              />
            </label>
            <div className="form-row">
              <label>
                마감일
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                계획 시간(분)
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={taskForm.plannedMinutes}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      plannedMinutes: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                카테고리
                <select
                  value={taskForm.categoryId}
                  onChange={(e) =>
                    setTaskForm((prev) => ({ ...prev, categoryId: e.target.value }))
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                우선순위
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((prev) => ({ ...prev, priority: e.target.value as Priority }))
                  }
                >
                  <option value="high">상</option>
                  <option value="medium">중</option>
                  <option value="low">하</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">{taskForm.id ? '수정 완료' : '추가'}</button>
              {taskForm.id && (
                <button type="button" className="ghost" onClick={resetTaskForm}>
                  취소
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>카테고리 & 목표</h2>
          <div className="category-manager">
            <div className="category-header">
              <h3>카테고리</h3>
              <button type="button" className="ghost" onClick={addCategory}>
                추가
              </button>
      </div>
            <ul>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <span className="chip" style={{ background: cat.color }}>
                    {cat.name}
                  </span>
                  {cat.id !== 'cat-all' && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => removeCategory(cat.id)}
                    >
                      삭제
        </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <form className="goal-form" onSubmit={addGoal}>
            <h3>개인 목표</h3>
            <input
              placeholder="목표 이름"
              value={goalForm.title}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <div className="form-row">
              <label>
                완료 목표(개)
                <input
                  type="number"
                  min={1}
                  value={goalForm.targetCount}
                  onChange={(e) =>
                    setGoalForm((prev) => ({ ...prev, targetCount: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                공부시간(분)
                <input
                  type="number"
                  min={30}
                  step={30}
                  value={goalForm.targetMinutes}
                  onChange={(e) =>
                    setGoalForm((prev) => ({ ...prev, targetMinutes: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
            <select
              value={goalForm.period}
              onChange={(e) =>
                setGoalForm((prev) => ({ ...prev, period: e.target.value as Goal['period'] }))
              }
            >
              <option value="weekly">주간 목표</option>
              <option value="monthly">월간 목표</option>
            </select>
            <button type="submit">목표 추가</button>
          </form>
          <ul className="goal-list">
            {goals.map((goal) => {
              const percent =
                goal.targetCount === 0
                  ? 0
                  : Math.min(100, Math.round((doneCount / goal.targetCount) * 100))
              return (
                <li key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <p>
                      {goal.period === 'weekly' ? '주간' : '월간'} · 목표 {goal.targetCount}개 /{' '}
                      {goal.targetMinutes}분
                    </p>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${percent}%` }} />
                    </div>
      </div>
                  <button type="button" className="ghost" onClick={() => deleteGoal(goal.id)}>
                    삭제
                  </button>
                </li>
              )
            })}
          </ul>
        </article>

        <article className="panel timer-panel">
          <h2>공부 타이머</h2>
          <select value={timerTaskId} onChange={(e) => setTimerTaskId(e.target.value)}>
            <option value="">일정을 선택하세요</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <p className="timer-display">
            {new Date(timerSeconds * 1000).toISOString().substring(11, 19)}
          </p>
          <div className="form-actions">
            <button type="button" onClick={handleTimerStart} disabled={!timerTaskId || timerRunning}>
              시작
            </button>
            <button type="button" className="ghost" onClick={handleTimerStop}>
              정지/기록
            </button>
            <button type="button" className="ghost" onClick={() => setTimerSeconds(0)}>
              초기화
            </button>
          </div>
        </article>
      </section>

      <section className="filters">
        <div className="filter-group">
          <label>
            검색
            <input
              placeholder="제목 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
          <label>
            카테고리
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">전체</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showTodayOnly}
              onChange={(e) => setShowTodayOnly(e.target.checked)}
            />
            오늘만
          </label>
        </div>
        <div className="filter-group">
          <select value={sortOption} onChange={(e) => setSortOption(e.target.value as any)}>
            <option value="due">마감일 순</option>
            <option value="priority">우선순위 순</option>
            <option value="latest">최신 등록 순</option>
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoSort}
              onChange={(e) => setAutoSort(e.target.checked)}
            />
            자동 정렬
          </label>
          <div className="view-tabs">
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              리스트
            </button>
            <button
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
            >
              주간
            </button>
            <button
              className={viewMode === 'month' ? 'active' : ''}
              onClick={() => setViewMode('month')}
            >
              월간
            </button>
          </div>
        </div>
      </section>

      {viewMode === 'list' && (
        <section className="tasks-panel">
          <h2>
            일정 목록 <span>{filteredTasks.length}개</span>
          </h2>
          <ul className="task-list">
            {filteredTasks.length === 0 && <p className="empty">일정이 없습니다.</p>}
            {filteredTasks.map((task) => {
              const category = categories.find((cat) => cat.id === task.categoryId)
              return (
                <li key={task.id} className={task.completed ? 'completed' : ''}>
                  <div className="task-main">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleCompletion(task.id)}
                      />
                      <span />
                    </label>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description || '설명이 없습니다.'}</p>
                      <div className="chips">
                        <span className={`chip priority ${task.priority}`}>
                          우선순위 {priorityLabel[task.priority]}
                        </span>
                        <span className="chip neutral">마감 {task.dueDate}</span>
                        {category && (
                          <span className="chip" style={{ background: category.color }}>
                            {category.name}
                          </span>
                        )}
                        <span className="chip neutral">
                          계획 {task.plannedMinutes}분 / 실제{' '}
                          {Math.round(task.loggedSeconds / 60)}분
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="task-actions">
                    <button className="ghost" onClick={() => handleEditTask(task)}>
                      수정
                    </button>
                    <button className="ghost" onClick={() => handleDeleteTask(task.id)}>
                      삭제
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {viewMode === 'week' && (
        <section className="calendar-panel">
          <h2>주간 일정</h2>
          <div className="week-grid">
            {Object.entries(weeklyBuckets).map(([date, items]) => (
              <div key={date} className="week-cell">
                <strong>{date}</strong>
                {items.length === 0 && <p className="empty">일정 없음</p>}
                <ul>
                  {items.map((task) => (
                    <li key={task.id}>
                      <span className={`dot ${task.priority}`} />
                      {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {viewMode === 'month' && (
        <section className="calendar-panel">
          <h2>월간 캘린더</h2>
          <div className="month-grid">
            {monthlyMatrix.map((cell, index) => (
              <div key={index} className="month-cell">
                {cell.date && (
                  <>
                    <span className="date-label">{cell.date.split('-')[2]}</span>
                    <ul>
                      {cell.tasks.map((task) => (
                        <li key={task.id}>
                          <span className={`dot ${task.priority}`} />
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
