import { useState, useRef } from 'react'
import { api } from '../lib/api'

export default function Scanner() {
  const [image, setImage] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [aiExplanation, setAiExplanation] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)

  async function handleImage(file) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImage(url)
    setExtractedText('')
    setAiExplanation('')
    setOcrLoading(true)
    setProgress(0)

    try {
      // Dynamically import Tesseract to keep initial bundle small
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: m => { if (m.progress) setProgress(Math.round(m.progress * 100)) }
      })
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      setExtractedText(text.trim())
    } catch {
      setExtractedText('OCR failed. Please try a clearer image.')
    } finally { setOcrLoading(false); setProgress(0) }
  }

  async function explainWithAI() {
    if (!extractedText) return
    setAiLoading(true)
    try {
      const res = await api.tutor({
        question: `Explain this science question/text and generate 2 similar practice questions:\n\n${extractedText}`,
        subject: 'Science', difficulty: 'intermediate'
      })
      setAiExplanation(res.answer)
    } catch (err) { setAiExplanation(`Error: ${err.message}`) }
    finally { setAiLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">📷 OCR Homework Scanner</h1>
      <p className="text-gray-500 text-sm mb-6">Upload a photo of your worksheet or textbook — AI will extract the text and explain it.</p>

      {/* Upload */}
      <div
        className="card border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 transition cursor-pointer text-center py-12"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleImage(e.dataTransfer.files[0]) }}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage(e.target.files[0])} />
        {image
          ? <img src={image} alt="uploaded" className="max-h-48 mx-auto rounded-lg object-contain" />
          : <>
              <p className="text-4xl mb-3">📸</p>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Click or drag to upload an image</p>
              <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WEBP</p>
            </>
        }
      </div>

      {/* OCR Progress */}
      {ocrLoading && (
        <div className="mt-4 card">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-xl">🔍</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Extracting text... {progress}%</p>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                <div className="h-2 bg-primary-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracted text */}
      {extractedText && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Extracted Text</h2>
            <button
              onClick={() => { setExtractedText(''); setImage(null); setAiExplanation('') }}
              className="text-xs text-gray-400 hover:text-red-500 transition">
              Clear
            </button>
          </div>
          <textarea
            className="input resize-none font-mono text-sm" rows={6}
            value={extractedText} onChange={e => setExtractedText(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">You can edit the text above before sending to AI.</p>
          <button onClick={explainWithAI} disabled={aiLoading} className="btn-primary mt-3 w-full">
            {aiLoading ? '🤖 Analysing...' : '🤖 Explain with AI + Generate Practice Questions'}
          </button>
        </div>
      )}

      {/* AI explanation */}
      {aiExplanation && (
        <div className="card mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h2 className="font-bold text-blue-900 dark:text-blue-200">AI Explanation</h2>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{aiExplanation}</p>
        </div>
      )}
    </div>
  )
}
