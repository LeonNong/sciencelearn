import { useState, useRef } from 'react'
import { api } from '../lib/api'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const SUBJECT_COLORS = {
  Biology: '#10b981', Chemistry: '#8b5cf6', Physics: '#f59e0b',
  Mathematics: '#3b82f6', 'Mathematical Literacy': '#06b6d4',
  English: '#ec4899', 'English HL': '#ec4899', Afrikaans: '#f97316',
  'Afrikaans FAL': '#f97316', isiZulu: '#84cc16', 'Life Orientation': '#a78bfa'
}

async function pdfToBase64(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const scale = 2
  const canvases = []
  let totalHeight = 0, maxWidth = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    canvases.push(canvas)
    totalHeight += viewport.height
    maxWidth = Math.max(maxWidth, viewport.width)
  }

  const merged = document.createElement('canvas')
  merged.width = maxWidth
  merged.height = totalHeight
  const ctx = merged.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, maxWidth, totalHeight)
  let y = 0
  for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height }
  return merged.toDataURL('image/jpeg', 0.9)
}

export default function Comments() {
  const [comments, setComments] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanPreview, setScanPreview] = useState(null)
  const [error, setError] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const fileRef = useRef()
  const cameraRef = useRef()
  const pdfRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setScanning(true)
    setError('')
    setShowOptions(false)
    try {
      let dataUrl
      if (file.type === 'application/pdf') {
        setScanPreview(null)
        dataUrl = await pdfToBase64(file)
      } else {
        dataUrl = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.readAsDataURL(file)
        })
        setScanPreview(dataUrl)
      }
      const base64 = dataUrl.split(',')[1]
      const result = await api.scanComments(base64, 'image/jpeg')
      if (result.comments.length === 0) {
        setError('No teacher comments found in the image. Try a clearer photo.')
      } else {
        setComments(prev => {
          // merge: newer scan overwrites same subject
          const merged = [...prev]
          for (const c of result.comments) {
            const idx = merged.findIndex(m => m.subject === c.subject)
            if (idx >= 0) merged[idx] = c
            else merged.push(c)
          }
          return merged
        })
      }
    } catch (err) {
      setError('Scan failed: ' + err.message)
      setScanPreview(null)
    } finally {
      setScanning(false)
    }
  }

  function removeComment(subject) {
    setComments(prev => prev.filter(c => c.subject !== subject))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">💬 Teacher Comments</h1>
      <p className="text-gray-400 text-xs">Upload your report card to extract teacher remarks per subject.</p>

      {/* Upload panel */}
      <div className="card space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />

        {scanning ? (
          <button disabled className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary-400 text-primary-400 text-sm font-medium">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            Scanning for comments...
          </button>
        ) : (
          <button onClick={() => setShowOptions(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary-400 text-primary-400 hover:bg-primary-900/20 transition text-sm font-medium">
            📷 Scan Report Card for Comments
          </button>
        )}

        {showOptions && !scanning && (
          <div className="border border-gray-700 overflow-hidden">
            <button onClick={() => cameraRef.current.click()}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 transition border-b border-gray-700">
              <span className="text-xl">📸</span>
              <div className="text-left">
                <div className="font-medium">Take Photo</div>
                <div className="text-xs text-gray-500">Open camera</div>
              </div>
            </button>
            <button onClick={() => fileRef.current.click()}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 transition border-b border-gray-700">
              <span className="text-xl">🖼️</span>
              <div className="text-left">
                <div className="font-medium">Choose from Gallery</div>
                <div className="text-xs text-gray-500">Select existing photo</div>
              </div>
            </button>
            <button onClick={() => pdfRef.current.click()}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 transition">
              <span className="text-xl">📄</span>
              <div className="text-left">
                <div className="font-medium">Upload PDF</div>
                <div className="text-xs text-gray-500">Select PDF report card</div>
              </div>
            </button>
          </div>
        )}

        {scanPreview && !scanning && (
          <img src={scanPreview} alt="preview" className="w-full object-cover max-h-40" />
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* Comments list */}
      {comments.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">Extracted Comments</h2>
            <button onClick={() => setComments([])}
              className="text-xs text-red-400 border border-red-800 px-3 py-1 hover:bg-red-900/30 transition">
              Clear All
            </button>
          </div>
          {comments.map(c => {
            const color = SUBJECT_COLORS[c.subject] || '#6b7280'
            return (
              <div key={c.subject} className="border border-gray-700 p-4 group relative"
                style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm" style={{ color }}>{c.subject}</span>
                  <div className="flex items-center gap-3">
                    {c.date && <span className="text-xs text-gray-500">{c.date}</span>}
                    <button onClick={() => removeComment(c.subject)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition text-xs">
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed italic">"{c.comment}"</p>
              </div>
            )
          })}
        </div>
      )}

      {comments.length === 0 && !scanning && (
        <div className="card text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-xs">No comments yet. Scan a report card to extract teacher remarks.</p>
        </div>
      )}
    </div>
  )
}
