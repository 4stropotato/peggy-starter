import { useState, useEffect, useRef } from 'react'
import { useApp } from '../AppContext'
import {
  savePhoto, getPhotos, deletePhoto, exportBackup, importBackup,
  buildBackupObject, restoreBackupObject
} from '../db'
import {
  areaInfo, governmentSupportInfo, budgetTipsInfo,
  healthTipsInfo, supplementsDetailInfo, babyNamesInfo, financialSummary
} from '../infoData'
import {
  isCloudConfigured, getCloudSession, cloudSignUp, cloudSignIn, cloudSignOut,
  cloudValidateSession, cloudUploadBackup, cloudDownloadBackup
} from '../cloudSync'

const PHOTO_CATEGORIES = ['Ultrasound', 'Documents', 'Receipts', 'Medical', 'Other']

const INFO_SECTIONS = [
  { id: 'gov', label: 'Gov Support', icon: '🏛️' },
  { id: 'budget', label: 'Budget Tips', icon: '💴' },
  { id: 'health', label: 'Health Tips', icon: '🧠' },
  { id: 'supps', label: 'Supplements', icon: '💊' },
  { id: 'names', label: 'Baby Names', icon: '👶' },
  { id: 'area', label: 'Area Info', icon: '🏢' },
  { id: 'money-summary', label: 'Total Benefits', icon: '💰' },
]

function InfoPanel({ section }) {
  const hasGov = governmentSupportInfo.length > 0
  const hasBudget = budgetTipsInfo.sections.length > 0
  const hasHealth = healthTipsInfo.sections.length > 0
  const hasSupps = supplementsDetailInfo.sections.length > 0
  const hasNames = babyNamesInfo.boyNames.length > 0 || babyNamesInfo.girlNames.length > 0
  const hasArea = Boolean(areaInfo.address)
  const hasMoneySummary = financialSummary.directCash.items.length > 0

  if (section === 'gov' && !hasGov) {
    return <div className="info-panel"><h3>Government Support Guide</h3><p className="empty-state">Blank scaffold. Add your local support programs in future patches.</p></div>
  }
  if (section === 'budget' && !hasBudget) {
    return <div className="info-panel"><h3>Budget Tips</h3><p className="empty-state">Blank scaffold. Add your own budget tips later.</p></div>
  }
  if (section === 'health' && !hasHealth) {
    return <div className="info-panel"><h3>Health Tips</h3><p className="empty-state">Blank scaffold. Add your own health notes later.</p></div>
  }
  if (section === 'supps' && !hasSupps) {
    return <div className="info-panel"><h3>Supplements</h3><p className="empty-state">Blank scaffold. No prefilled supplement guide.</p></div>
  }
  if (section === 'names' && !hasNames) {
    return <div className="info-panel"><h3>Baby Names</h3><p className="empty-state">Blank scaffold. Add your own baby name ideas.</p></div>
  }
  if (section === 'area' && !hasArea) {
    return <div className="info-panel"><h3>Area Info</h3><p className="empty-state">Blank scaffold. No prefilled city/phone details.</p></div>
  }
  if (section === 'money-summary' && !hasMoneySummary) {
    return <div className="info-panel"><h3>Total Benefits</h3><p className="empty-state">Blank scaffold. Add your own cost/benefit assumptions.</p></div>
  }

  return <div className="info-panel"><p className="empty-state">This section is empty in the public scaffold.</p></div>
}

export default function MoreTab() {
  const { doctor, setDoctor, contacts, addContact, removeContact, updateContact } = useApp()
  const [subTab, setSubTab] = useState('info')
  const [infoSection, setInfoSection] = useState('gov')
  const [photoCategory, setPhotoCategory] = useState('Ultrasound')
  const [photos, setPhotos] = useState([])
  const [viewPhoto, setViewPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', phone: '', relationship: '' })
  const [backupStatus, setBackupStatus] = useState('')
  const [cloudStatus, setCloudStatus] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudSession, setCloudSession] = useState(() => getCloudSession())
  const fileRef = useRef()
  const restoreRef = useRef()
  const cloudEnabled = isCloudConfigured()

  useEffect(() => {
    if (subTab === 'photos') loadPhotos()
  }, [photoCategory, subTab])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onCloudSessionChanged = (event) => {
      setCloudSession(event?.detail?.session || null)
    }
    window.addEventListener('peggy-cloud-session-changed', onCloudSessionChanged)
    return () => window.removeEventListener('peggy-cloud-session-changed', onCloudSessionChanged)
  }, [])

  useEffect(() => {
    if (!cloudEnabled) return
    const session = getCloudSession()
    if (!session) return

    cloudValidateSession(session)
      .then(validated => setCloudSession(validated))
      .catch(() => setCloudSession(null))
  }, [cloudEnabled])

  const loadPhotos = async () => {
    try {
      const p = await getPhotos(photoCategory)
      setPhotos(p)
    } catch { setPhotos([]) }
  }

  const handleUpload = async (e) => {
    const files = e.target.files
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        await savePhoto(photoCategory, file)
      }
      await loadPhotos()
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDelete = async (id) => {
    await deletePhoto(id)
    await loadPhotos()
    setViewPhoto(null)
  }

  const handleAddContact = (e) => {
    e.preventDefault()
    if (!contactForm.name) return
    if (editContact) return
    addContact(contactForm)
    setContactForm({ name: '', phone: '', relationship: '' })
  }

  const startEditContact = (c) => {
    setEditContact(c.id)
    setContactForm({ name: c.name, phone: c.phone, relationship: c.relationship })
  }

  const saveEditContact = () => {
    updateContact(editContact, contactForm)
    setEditContact(null)
    setContactForm({ name: '', phone: '', relationship: '' })
  }

  const handleExport = async () => {
    try {
      setBackupStatus('Exporting...')
      await exportBackup()
      setBackupStatus('Backup downloaded! Keep it safe.')
      setTimeout(() => setBackupStatus(''), 5000)
    } catch (err) {
      setBackupStatus('Export failed: ' + err.message)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setBackupStatus('Restoring...')
      const result = await importBackup(file)
      setBackupStatus(`Restored! ${result.items} data items + ${result.photos} photos.`)
    } catch (err) {
      setBackupStatus('Restore failed: ' + err.message)
    }
    if (restoreRef.current) restoreRef.current.value = ''
  }

  const handleCloudSignUp = async () => {
    if (!cloudEnabled) {
      setCloudStatus('Cloud not configured. Add Supabase env vars first.')
      return
    }
    if (!cloudEmail || !cloudPassword) {
      setCloudStatus('Enter email and password first.')
      return
    }

    try {
      setCloudBusy(true)
      setCloudStatus('Creating account...')
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      const result = await cloudSignUp(cloudEmail.trim(), cloudPassword, redirectTo)
      setCloudSession(result.session || null)
      setCloudStatus(result.message)
    } catch (err) {
      setCloudStatus('Signup failed: ' + err.message)
    } finally {
      setCloudBusy(false)
    }
  }

  const handleCloudSignIn = async () => {
    if (!cloudEnabled) {
      setCloudStatus('Cloud not configured. Add Supabase env vars first.')
      return
    }
    if (!cloudEmail || !cloudPassword) {
      setCloudStatus('Enter email and password first.')
      return
    }

    try {
      setCloudBusy(true)
      setCloudStatus('Signing in...')
      const session = await cloudSignIn(cloudEmail.trim(), cloudPassword)
      setCloudSession(session)
      setCloudStatus(`Signed in as ${session.user.email || session.user.id}. Syncing account data...`)
    } catch (err) {
      setCloudStatus('Sign in failed: ' + err.message)
    } finally {
      setCloudBusy(false)
    }
  }

  const handleCloudSignOut = async () => {
    try {
      setCloudBusy(true)
      await cloudSignOut()
      setCloudSession(null)
      setCloudStatus('Signed out.')
    } catch (err) {
      setCloudStatus('Sign out failed: ' + err.message)
    } finally {
      setCloudBusy(false)
    }
  }

  const handleCloudUpload = async () => {
    if (!cloudSession) {
      setCloudStatus('Sign in first.')
      return
    }

    try {
      setCloudBusy(true)
      setCloudStatus('Uploading cloud backup...')
      const backup = await buildBackupObject()
      await cloudUploadBackup(backup, cloudSession)
      setCloudStatus('Cloud backup uploaded successfully.')
    } catch (err) {
      setCloudStatus('Cloud upload failed: ' + err.message)
    } finally {
      setCloudBusy(false)
    }
  }

  const handleCloudDownload = async () => {
    if (!cloudSession) {
      setCloudStatus('Sign in first.')
      return
    }

    try {
      setCloudBusy(true)
      setCloudStatus('Downloading cloud backup...')
      const { backup } = await cloudDownloadBackup(cloudSession)
      const result = await restoreBackupObject(backup)
      setCloudStatus(`Cloud restore complete: ${result.items} items + ${result.photos} photos.`)
    } catch (err) {
      setCloudStatus('Cloud download failed: ' + err.message)
    } finally {
      setCloudBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="sub-tabs glass-tabs">
        {['info', 'photos', 'doctor', 'contacts', 'backup'].map(t => (
          <button key={t} className={`glass-tab ${subTab === t ? 'active' : ''}`} onClick={() => setSubTab(t)}>
            {t === 'info' ? '📖 Info' : t === 'photos' ? '📷 Photos' : t === 'doctor' ? '👨‍⚕️ Doctor' : t === 'contacts' ? '📞 Contacts' : '💾 Backup'}
          </button>
        ))}
      </div>

      {subTab === 'info' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">📖</span>
            <div>
              <h2>Knowledge Base</h2>
              <span className="section-count">Blank starter</span>
            </div>
          </div>
          <p className="section-note">This public app starts blank. Add your own location, programs, and references over time.</p>

          <div className="info-nav">
            {INFO_SECTIONS.map(s => (
              <button
                key={s.id}
                className={`info-nav-btn glass-inner ${infoSection === s.id ? 'active' : ''}`}
                onClick={() => setInfoSection(s.id)}
              >
                <span className="info-nav-icon">{s.icon}</span>
                <span className="info-nav-label">{s.label}</span>
              </button>
            ))}
          </div>

          <InfoPanel section={infoSection} />
        </section>
      )}

      {subTab === 'photos' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">📷</span>
            <div>
              <h2>Photo Gallery</h2>
              <span className="section-count">{photos.length} photos</span>
            </div>
          </div>
          <p className="section-note">Upload ultrasounds, documents, receipts. All stored on your device only.</p>

          <div className="photo-categories">
            {PHOTO_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`photo-cat-btn glass-inner ${photoCategory === cat ? 'active' : ''}`}
                onClick={() => setPhotoCategory(cat)}
              >{cat}</button>
            ))}
          </div>

          <div className="photo-upload">
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} id="photo-input" style={{ display: 'none' }} />
            <button className="btn-glass-primary upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : `Upload to ${photoCategory}`}
            </button>
          </div>

          {photos.length > 0 ? (
            <div className="photo-grid">
              {photos.map(p => (
                <div key={p.id} className="photo-thumb" onClick={() => setViewPhoto(p)}>
                  <img src={p.data} alt={p.name} />
                  <div className="photo-date">{new Date(p.date).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No {photoCategory.toLowerCase()} photos yet.</p>
          )}

          {viewPhoto && (
            <div className="photo-modal" onClick={() => setViewPhoto(null)}>
              <div className="photo-modal-content" onClick={e => e.stopPropagation()}>
                <img src={viewPhoto.data} alt={viewPhoto.name} />
                <div className="photo-modal-info">
                  <span>{viewPhoto.name}</span>
                  <span>{new Date(viewPhoto.date).toLocaleDateString()}</span>
                </div>
                <div className="photo-modal-actions">
                  <button className="btn-glass-secondary" onClick={() => setViewPhoto(null)}>Close</button>
                  <button className="btn-delete" onClick={() => handleDelete(viewPhoto.id)}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {subTab === 'doctor' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">👨‍⚕️</span>
            <div><h2>Doctor / Hospital Info</h2></div>
          </div>
          <p className="section-note">Save your OB-GYN and hospital details for quick access.</p>

          <div className="doctor-form">
            <div className="form-row"><label>OB-GYN Name</label>
              <input type="text" value={doctor.name} onChange={e => setDoctor(p => ({ ...p, name: e.target.value }))} placeholder="Dr. ..." />
            </div>
            <div className="form-row"><label>Hospital / Clinic</label>
              <input type="text" value={doctor.hospital} onChange={e => setDoctor(p => ({ ...p, hospital: e.target.value }))} placeholder="Hospital name" />
            </div>
            <div className="form-row"><label>Phone</label>
              <div className="input-with-action">
                <input type="tel" value={doctor.phone} onChange={e => setDoctor(p => ({ ...p, phone: e.target.value }))} placeholder="0XX-XXXX-XXXX" />
                {doctor.phone && <a href={`tel:${doctor.phone}`} className="btn-call">Call</a>}
              </div>
            </div>
            <div className="form-row"><label>Address</label>
              <input type="text" value={doctor.address} onChange={e => setDoctor(p => ({ ...p, address: e.target.value }))} placeholder="Hospital address" />
            </div>
            <div className="form-row"><label>Notes</label>
              <textarea value={doctor.notes} onChange={e => setDoctor(p => ({ ...p, notes: e.target.value }))} placeholder="Visiting hours, special instructions, etc." />
            </div>
          </div>
        </section>
      )}

      {subTab === 'contacts' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">📞</span>
            <div>
              <h2>Emergency Contacts</h2>
              <span className="section-count">{contacts.length} contacts</span>
            </div>
          </div>
          <p className="section-note">Keep important contacts handy. Tap the phone button to call.</p>

          <ul className="contact-list">
            {contacts.map(c => (
              <li key={c.id} className="glass-card contact-item">
                {editContact === c.id ? (
                  <div className="contact-edit">
                    <input type="text" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
                    <input type="tel" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                    <input type="text" value={contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))} placeholder="Relationship" />
                    <div className="form-buttons">
                      <button className="btn-glass-primary" onClick={saveEditContact}>Save</button>
                      <button className="btn-glass-secondary" onClick={() => { setEditContact(null); setContactForm({ name: '', phone: '', relationship: '' }) }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="contact-display">
                    <div className="contact-info" onClick={() => startEditContact(c)}>
                      <div className="contact-name">{c.name}</div>
                      <div className="contact-role">{c.relationship}</div>
                      {c.phone && <div className="contact-phone">{c.phone}</div>}
                    </div>
                    <div className="contact-actions">
                      {c.phone && <a href={`tel:${c.phone}`} className="btn-call">📞</a>}
                      <button className="btn-delete-sm" onClick={() => removeContact(c.id)}>×</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form className="add-contact-form glass-card" onSubmit={handleAddContact}>
            <h3>Add Contact</h3>
            <input type="text" value={editContact ? '' : contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" required disabled={!!editContact} />
            <input type="tel" value={editContact ? '' : contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" disabled={!!editContact} />
            <input type="text" value={editContact ? '' : contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))} placeholder="Relationship" disabled={!!editContact} />
            <button type="submit" className="btn-glass-primary" disabled={!!editContact}>Add Contact</button>
          </form>
        </section>
      )}

      {subTab === 'backup' && (
        <section className="glass-section">
          <div className="section-header">
            <span className="section-icon">💾</span>
            <div><h2>Data Backup & Restore</h2></div>
          </div>

          <div className="backup-section">
            <p className="section-note">
              Your data is stored in localStorage + IndexedDB. Para safe talaga, mag-backup ka regularly!
            </p>

            <div className="backup-actions">
              <div className="glass-card backup-card">
                <h3>Export Backup</h3>
                <p className="section-note">Downloads a JSON file with ALL your data + photos.</p>
                <button className="btn-glass-primary" onClick={handleExport}>Download Backup</button>
              </div>
              <div className="glass-card backup-card">
                <h3>Restore from Backup</h3>
                <p className="section-note">Upload a backup file. This overwrites current data.</p>
                <input ref={restoreRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                <button className="btn-glass-secondary" onClick={() => restoreRef.current?.click()}>Upload Backup File</button>
              </div>
              <div className="glass-card backup-card">
                <h3>Cloud Sync (Supabase)</h3>
                {!cloudEnabled ? (
                  <p className="section-note">Not configured yet. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `app-public/.env.local`.</p>
                ) : (
                  <>
                    <p className="section-note">Auto-sync is enabled per account. On sign in, your cloud data is applied automatically.</p>
                    {cloudSession ? (
                      <p className="cloud-user">Signed in: {cloudSession.user.email || cloudSession.user.id}</p>
                    ) : (
                      <>
                        <div className="form-row">
                          <label>Email</label>
                          <input
                            type="email"
                            value={cloudEmail}
                            onChange={e => setCloudEmail(e.target.value)}
                            placeholder="you@example.com"
                            disabled={cloudBusy}
                          />
                        </div>
                        <div className="form-row">
                          <label>Password</label>
                          <input
                            type="password"
                            value={cloudPassword}
                            onChange={e => setCloudPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            disabled={cloudBusy}
                          />
                        </div>
                        <div className="backup-cloud-actions">
                          <button className="btn-glass-primary" onClick={handleCloudSignIn} disabled={cloudBusy}>Sign In</button>
                          <button className="btn-glass-secondary" onClick={handleCloudSignUp} disabled={cloudBusy}>Sign Up</button>
                        </div>
                      </>
                    )}

                    {cloudSession && (
                      <div className="backup-cloud-actions">
                        <button className="btn-glass-primary" onClick={handleCloudUpload} disabled={cloudBusy}>Force Upload</button>
                        <button className="btn-glass-secondary" onClick={handleCloudDownload} disabled={cloudBusy}>Force Download</button>
                        <button className="btn-glass-secondary" onClick={handleCloudSignOut} disabled={cloudBusy}>Sign Out</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {backupStatus && <div className="backup-status glass-card">{backupStatus}</div>}
            {cloudStatus && <div className="backup-status cloud-status glass-card">{cloudStatus}</div>}

            <div className="glass-card">
              <h3>Data Safety Tips</h3>
              <ul className="safety-tips">
                <li>Backup after every checkup or important data entry</li>
                <li>Save backup to cloud (iCloud, Google Drive)</li>
                <li>Deleting browser history MIGHT delete localStorage</li>
                <li>IndexedDB is safer but not 100% guaranteed</li>
                <li>The backup file has EVERYTHING including photos</li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

