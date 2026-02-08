import { useState, useMemo } from 'react'
import { useApp } from '../AppContext'
import { supplements, checkupSchedule } from '../data'
import Calendar, { isoToDateString } from '../components/Calendar'

const MOOD_EMOJIS = ['??', '??', '??', '??', '??', '??', '??', '??']

function getFirstTrackingDate(dailySupp) {
  let earliest = null
  for (const key of Object.keys(dailySupp)) {
    const parts = key.split('-')
    const dateStr = parts.slice(2).join('-')
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d
  }
  return earliest
}

function getSuppDayStatus(dailySupp, suppSchedule, dateISO, firstTrackDate) {
  const ds = isoToDateString(dateISO)
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (dateISO > todayISO) return 'future'

  if (firstTrackDate) {
    const cellDate = new Date(ds)
    if (cellDate < firstTrackDate) return 'future'
  } else {
    return 'future'
  }

  let total = 0
  let taken = 0
  supplements.forEach((s) => {
    const sched = suppSchedule[s.id]
    const times = sched?.times || s.defaultTimes
    times.forEach((_, i) => {
      total += 1
      if (dailySupp[`${s.id}-${i}-${ds}`]) taken += 1
    })
  })

  if (total === 0) return 'future'
  if (taken === total) return 'all'
  if (taken > 0) return 'partial'
  return 'missed'
}

export default function HealthTab() {
  const {
    dailySupp,
    isSuppTaken,
    toggleSupp,
    undoSupp,
    checkups,
    updateCheckup,
    moods,
    addMood,
    suppSchedule,
    attendance,
    markAttendance,
  } = useApp()

  const [subTab, setSubTab] = useState('supps')
  const [editVisit, setEditVisit] = useState(null)
  const [visitForm, setVisitForm] = useState({})
  const [moodForm, setMoodForm] = useState({ mood: '', energy: 3, cravings: '', notes: '' })
  const [showCalendar, setShowCalendar] = useState({ supps: true, work: true, checkups: true, mood: true })

  const now = new Date()
  const [suppCal, setSuppCal] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [workCal, setWorkCal] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [checkCal, setCheckCal] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [moodCal, setMoodCal] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })

  const [attendanceDate, setAttendanceDate] = useState(now.toISOString().split('T')[0])
  const [attendanceForm, setAttendanceForm] = useState({ worked: true, hours: 8, note: '' })

  const suppTaken = supplements.filter((s) => {
    const schedule = suppSchedule[s.id]
    const times = schedule?.times || s.defaultTimes
    return times.every((_, i) => isSuppTaken(s.id, i))
  }).length
  const suppTotal = supplements.length

  const checkupTotal = checkupSchedule.length
  const completedCheckups = checkupSchedule.filter((v) => checkups[v.id]?.completed).length

  const handleVisitSave = (visitId) => {
    updateCheckup(visitId, { ...visitForm, completed: true })
    setEditVisit(null)
    setVisitForm({})
  }

  const startEditVisit = (visit) => {
    setEditVisit(visit.id)
    setVisitForm(checkups[visit.id] || { date: '', weight: '', bp: '', babySize: '', notes: '', nextDate: '' })
  }

  const handleMoodSubmit = (e) => {
    e.preventDefault()
    if (!moodForm.mood) return
    addMood(moodForm)
    setMoodForm({ mood: '', energy: 3, cravings: '', notes: '' })
  }

  const handleAttendanceSave = () => {
    markAttendance(attendanceDate, attendanceForm)
    setAttendanceForm({ worked: true, hours: 8, note: '' })
  }

  const toggleCalendar = (tab) => {
    setShowCalendar((prev) => ({ ...prev, [tab]: !prev[tab] }))
  }

  const viewMonth = `${workCal.y}-${String(workCal.m).padStart(2, '0')}`
  const monthAttendance = useMemo(() => {
    return Object.entries(attendance)
      .filter(([date]) => date.startsWith(viewMonth))
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [attendance, viewMonth])

  const daysWorked = monthAttendance.filter((a) => a.worked).length
  const totalHours = monthAttendance.filter((a) => a.worked).reduce((acc, a) => acc + (Number(a.hours) || 0), 0)

  const moodByDate = useMemo(() => {
    const map = {}
    moods.forEach((m) => {
      const d = new Date(m.date)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map[iso]) map[iso] = m
    })
    return map
  }, [moods])

  const firstTrackDate = useMemo(() => getFirstTrackingDate(dailySupp), [dailySupp])

  const checkupDates = useMemo(() => {
    const map = {}
    checkupSchedule.forEach((v) => {
      const data = checkups[v.id]
      if (data?.date) map[data.date] = v
    })
    return map
  }, [checkups])

  return (
    <div className="content">
      <div className="sub-tabs glass-tabs">
        {['supps', 'work', 'checkups', 'mood'].map((t) => (
          <button key={t} className={`glass-tab ${subTab === t ? 'active' : ''}`} onClick={() => setSubTab(t)}>
            {t === 'supps' ? '?? Supps' : t === 'work' ? '?? Work' : t === 'checkups' ? '?? Checkups' : '?? Mood'}
          </button>
        ))}
      </div>

      {subTab === 'supps' && (
        <>
          <section className="glass-section">
            <div className="section-header">
              <span className="section-icon">??</span>
              <div>
                <h2>Supplement Tracker</h2>
                <span className="section-count">{suppTaken}/{suppTotal} complete today</span>
              </div>
              <button
                type="button"
                className="cal-collapse-btn"
                onClick={() => toggleCalendar('supps')}
                aria-expanded={showCalendar.supps}
              >
                {showCalendar.supps ? 'Hide calendar' : 'Show calendar'}
              </button>
            </div>

            {showCalendar.supps && (
              <>
                <Calendar
                  year={suppCal.y}
                  month={suppCal.m}
                  onMonthChange={(y, m) => setSuppCal({ y, m })}
                  renderDay={(dateISO) => {
                    const st = getSuppDayStatus(dailySupp, suppSchedule, dateISO, firstTrackDate)
                    if (st === 'future') return null
                    return <span className={`cal-dot supp-dot-${st}`} />
                  }}
                />
                <div className="cal-legend">
                  <span className="cal-legend-item"><span className="cal-dot supp-dot-all" /> All taken</span>
                  <span className="cal-legend-item"><span className="cal-dot supp-dot-partial" /> Partial</span>
                  <span className="cal-legend-item"><span className="cal-dot supp-dot-missed" /> Missed</span>
                </div>
              </>
            )}
          </section>

          <section className="glass-section">
            {supplements.length === 0 ? (
              <p className="empty-state">No prefilled supplements. This scaffold starts blank.</p>
            ) : (
              <ul className="supp-grid">
                {supplements.map((s) => {
                  const schedule = suppSchedule[s.id]
                  const times = schedule?.times || s.defaultTimes
                  return (
                    <li key={s.id} className="glass-card">
                      <div className="section-header" style={{ marginBottom: '0.5rem' }}>
                        <div>
                          <h3>{s.name}</h3>
                          <span className="section-count">{times.filter((_, i) => isSuppTaken(s.id, i)).length}/{times.length}</span>
                        </div>
                      </div>
                      <div className="form-buttons">
                        {times.map((time, i) => {
                          const taken = isSuppTaken(s.id, i)
                          return (
                            <button
                              key={`${s.id}-${i}`}
                              className={taken ? 'btn-glass-secondary' : 'btn-glass-primary'}
                              onClick={() => (taken ? undoSupp(s.id, i) : toggleSupp(s.id, i))}
                            >
                              {taken ? `Undo ${time}` : `Take ${time}`}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {subTab === 'work' && (
        <>
          <section className="glass-section">
            <div className="section-header">
              <span className="section-icon">??</span>
              <div><h2>Work Attendance</h2></div>
              <button
                type="button"
                className="cal-collapse-btn"
                onClick={() => toggleCalendar('work')}
                aria-expanded={showCalendar.work}
              >
                {showCalendar.work ? 'Hide calendar' : 'Show calendar'}
              </button>
            </div>
            {showCalendar.work && (
              <Calendar
                year={workCal.y}
                month={workCal.m}
                onMonthChange={(y, m) => setWorkCal({ y, m })}
                selectedDate={attendanceDate}
                onDayClick={(d) => {
                  setAttendanceDate(d)
                  setAttendanceForm(attendance[d] || { worked: true, hours: 8, note: '' })
                }}
                renderDay={(dateISO) => {
                  const att = attendance[dateISO]
                  if (!att) return null
                  return <span className={`cal-dot ${att.worked ? 'work-dot-yes' : 'work-dot-no'}`} />
                }}
              />
            )}

            <div className="glass-card attendance-form">
              <h3>Log: {attendanceDate}</h3>
              <div className="attendance-toggle">
                <button className={`att-btn ${attendanceForm.worked ? 'active worked' : ''}`} onClick={() => setAttendanceForm((p) => ({ ...p, worked: true }))}>Worked</button>
                <button className={`att-btn ${!attendanceForm.worked ? 'active absent' : ''}`} onClick={() => setAttendanceForm((p) => ({ ...p, worked: false }))}>Absent</button>
              </div>
              {attendanceForm.worked && (
                <div className="form-row">
                  <label>Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    value={attendanceForm.hours}
                    onChange={(e) => setAttendanceForm((p) => ({ ...p, hours: Number(e.target.value) }))}
                  />
                </div>
              )}
              <div className="form-row">
                <label>Note (optional)</label>
                <input
                  type="text"
                  value={attendanceForm.note}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. half day, overtime"
                />
              </div>
              <button className="btn-glass-primary" onClick={handleAttendanceSave}>Save</button>
            </div>
          </section>

          <section className="glass-section">
            <div className="section-header">
              <span className="section-icon">??</span>
              <div><h2>Monthly Summary — {viewMonth}</h2></div>
            </div>
            <div className="attendance-stats">
              <div className="att-stat glass-inner"><div className="att-stat-num">{daysWorked}</div><div className="att-stat-label">Days Worked</div></div>
              <div className="att-stat glass-inner"><div className="att-stat-num">{totalHours}</div><div className="att-stat-label">Total Hours</div></div>
              <div className="att-stat glass-inner"><div className="att-stat-num">{monthAttendance.filter((a) => !a.worked).length}</div><div className="att-stat-label">Days Off</div></div>
            </div>
          </section>
        </>
      )}

      {subTab === 'checkups' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">??</span>
            <div>
              <h2>Checkup Visits</h2>
              <span className="section-count">{completedCheckups}/{checkupTotal} completed</span>
            </div>
            <button
              type="button"
              className="cal-collapse-btn"
              onClick={() => toggleCalendar('checkups')}
              aria-expanded={showCalendar.checkups}
            >
              {showCalendar.checkups ? 'Hide calendar' : 'Show calendar'}
            </button>
          </div>

          {showCalendar.checkups && (
            <Calendar
              year={checkCal.y}
              month={checkCal.m}
              onMonthChange={(y, m) => setCheckCal({ y, m })}
              renderDay={(dateISO) => (checkupDates[dateISO] ? <span className="cal-icon">??</span> : null)}
            />
          )}

          {checkupTotal === 0 ? (
            <p className="empty-state">No prefilled checkup plan. Add your own schedule in future patches.</p>
          ) : (
            <ul className="checkup-list">
              {checkupSchedule.map((visit) => {
                const data = checkups[visit.id] || {}
                const isEditing = editVisit === visit.id
                return (
                  <li key={visit.id} className={`glass-card checkup-item ${data.completed ? 'completed' : ''}`}>
                    <div className="checkup-header" onClick={() => !isEditing && startEditVisit(visit)}>
                      <div className={`checkup-num ${data.completed ? 'done' : ''}`}>{data.completed ? '?' : visit.visit}</div>
                      <div className="checkup-info">
                        <div className="checkup-title">Visit {visit.visit} - Week {visit.weekRange}</div>
                        <div className="checkup-desc">{visit.label}</div>
                        {data.completed && data.date && <div className="checkup-date">Done: {data.date}</div>}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="checkup-form">
                        <div className="form-row"><label>Date</label><input type="date" value={visitForm.date || ''} onChange={(e) => setVisitForm((p) => ({ ...p, date: e.target.value }))} /></div>
                        <div className="form-row"><label>Weight (kg)</label><input type="number" step="0.1" value={visitForm.weight || ''} onChange={(e) => setVisitForm((p) => ({ ...p, weight: e.target.value }))} /></div>
                        <div className="form-row"><label>Blood Pressure</label><input type="text" value={visitForm.bp || ''} onChange={(e) => setVisitForm((p) => ({ ...p, bp: e.target.value }))} /></div>
                        <div className="form-row"><label>Baby Size</label><input type="text" value={visitForm.babySize || ''} onChange={(e) => setVisitForm((p) => ({ ...p, babySize: e.target.value }))} /></div>
                        <div className="form-row"><label>Doctor Notes</label><textarea value={visitForm.notes || ''} onChange={(e) => setVisitForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                        <div className="form-row"><label>Next Appointment</label><input type="date" value={visitForm.nextDate || ''} onChange={(e) => setVisitForm((p) => ({ ...p, nextDate: e.target.value }))} /></div>
                        <div className="form-buttons">
                          <button className="btn-glass-primary" onClick={() => handleVisitSave(visit.id)}>Save</button>
                          <button className="btn-glass-secondary" onClick={() => { setEditVisit(null); setVisitForm({}) }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {subTab === 'mood' && (
        <>
          <section className="glass-section">
            <div className="section-header">
              <span className="section-icon">??</span>
              <div><h2>Mood Log</h2></div>
              <button
                type="button"
                className="cal-collapse-btn"
                onClick={() => toggleCalendar('mood')}
                aria-expanded={showCalendar.mood}
              >
                {showCalendar.mood ? 'Hide calendar' : 'Show calendar'}
              </button>
            </div>

            {showCalendar.mood && (
              <Calendar
                year={moodCal.y}
                month={moodCal.m}
                onMonthChange={(y, m) => setMoodCal({ y, m })}
                renderDay={(dateISO) => {
                  const m = moodByDate[dateISO]
                  return m ? <span className="cal-icon cal-mood-icon">{m.mood}</span> : null
                }}
              />
            )}

            <form className="mood-form" onSubmit={handleMoodSubmit}>
              <div className="mood-emojis">
                {MOOD_EMOJIS.map((e) => (
                  <button key={e} type="button" className={`mood-emoji glass-inner ${moodForm.mood === e ? 'selected' : ''}`} onClick={() => setMoodForm((p) => ({ ...p, mood: e }))}>{e}</button>
                ))}
              </div>

              <div className="form-row">
                <label>Energy Level: {moodForm.energy}/5</label>
                <input type="range" min="1" max="5" value={moodForm.energy} onChange={(e) => setMoodForm((p) => ({ ...p, energy: Number(e.target.value) }))} />
              </div>

              <div className="form-row">
                <label>Cravings</label>
                <input type="text" value={moodForm.cravings} onChange={(e) => setMoodForm((p) => ({ ...p, cravings: e.target.value }))} placeholder="Optional" />
              </div>

              <div className="form-row">
                <label>Notes</label>
                <textarea value={moodForm.notes} onChange={(e) => setMoodForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
              </div>

              <button type="submit" className="btn-glass-primary" disabled={!moodForm.mood}>Log Mood</button>
            </form>
          </section>

          {moods.length > 0 && (
            <section className="glass-section">
              <div className="section-header">
                <span className="section-icon">??</span>
                <div><h2>Mood History</h2><span className="section-count">{moods.length} entries</span></div>
              </div>
              <ul className="mood-list">
                {moods.slice(0, 20).map((m) => (
                  <li key={m.id} className="glass-card mood-entry">
                    <div className="mood-entry-top">
                      <span className="mood-entry-emoji">{m.mood}</span>
                      <span className="mood-entry-energy">Energy: {m.energy}/5</span>
                      <span className="mood-entry-date">{new Date(m.date).toLocaleDateString()}</span>
                    </div>
                    {m.cravings && <div className="mood-entry-craving">Craving: {m.cravings}</div>}
                    {m.notes && <div className="mood-entry-notes">{m.notes}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}