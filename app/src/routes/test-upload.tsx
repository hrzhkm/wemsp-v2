import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Trash2, FileJson } from 'lucide-react'
import { getFileUrl } from '@/lib/storage/aws'

export const Route = createFileRoute('/test-upload')({
  component: TestUploadPage,
})

interface UploadResult {
  success: boolean
  url: string
  key: string
  fileName: string
  fileSize: number
  fileType: string
}

function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jsonUploading, setJsonUploading] = useState(false)
  const [jsonResult, setJsonResult] = useState<{ url: string; key: string } | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Upload failed')
      }

      const data: UploadResult = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!result) return

    try {
      const response = await fetch(`/api/upload?key=${encodeURIComponent(result.key)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      setResult(null)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleJsonUpload = async () => {
    setJsonUploading(true)
    setJsonError(null)
    setJsonResult(null)

    try {
      const response = await fetch('/api/upload/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello World' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setJsonResult({ url: data.url, key: data.key })
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Failed to upload JSON')
    } finally {
      setJsonUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">S3 Upload Test</h1>

        {/* Upload Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload a PDF File</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select File</label>
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              Accepts PDF and images (max 10MB)
            </p>
          </div>

          {file && (
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload to S3
              </>
            )}
          </button>
        </div>

        {/* JSON Test Upload */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test JSON Upload</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload a test JSON file with content <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{`{ "text": "Hello World" }`}</code> to the <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">/test</code> folder.
          </p>

          <button
            onClick={handleJsonUpload}
            disabled={jsonUploading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {jsonUploading ? (
              <>Uploading JSON...</>
            ) : (
              <>
                <FileJson className="w-4 h-4" />
                Upload Test JSON
              </>
            )}
          </button>

          {/* JSON Error Display */}
          {jsonError && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-5 h-5" />
                <p className="text-sm">{jsonError}</p>
              </div>
            </div>
          )}

          {/* JSON Success Display */}
          {jsonResult && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium text-sm">JSON Upload Successful!</p>
              </div>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">S3 Key:</span>
                  <code className="ml-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                    {jsonResult.key}
                  </code>
                </div>
                <div>
                  <span className="font-medium">URL:</span>
                  <a
                    href={getFileUrl(jsonResult.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-green-600 dark:text-green-400 hover:underline break-all"
                  >
                    {window.location.origin + getFileUrl(jsonResult.key)}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <p className="font-medium">Error</p>
            </div>
            <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {result && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
              <CheckCircle className="w-5 h-5" />
              <p className="font-medium">Upload Successful!</p>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">File Name:</span> {result.fileName}
              </div>
              <div>
                <span className="font-medium">Size:</span> {formatFileSize(result.fileSize)}
              </div>
              <div>
                <span className="font-medium">Type:</span> {result.fileType}
              </div>
              <div>
                <span className="font-medium">Your Domain URL:</span>
                <a
                  href={getFileUrl(result.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-green-600 dark:text-green-400 hover:underline break-all"
                >
                  {window.location.origin + getFileUrl(result.key)}
                </a>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">✅ This URL works!</p>
              </div>
              <div>
                <span className="font-medium">S3 Key:</span>
                <code className="ml-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  {result.key}
                </code>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <a
                href={getFileUrl(result.key)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-center font-medium py-2 px-4 rounded-lg transition-colors"
              >
                View/Download File
              </a>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            How It Works
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
            <p>Your S3 bucket is <strong>private</strong> (secure). Access files through your domain:</p>
            <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded text-xs font-mono space-y-1">
              <p className="text-green-600 dark:text-green-400">✓ yourdomain.com/api/file/uploads/xxx.pdf</p>
              <p className="text-gray-500 dark:text-gray-400">→ Automatically generates signed URL</p>
              <p className="text-gray-500 dark:text-gray-400">→ Redirects to temporary S3 URL</p>
              <p className="text-red-600 dark:text-red-400 line-through mt-2">✗ bucket.s3.amazonaws.com/uploads/xxx.pdf (Access Denied)</p>
            </div>
            <p className="mt-2"><strong>Benefits:</strong></p>
            <ul className="ml-4 space-y-0.5 list-disc">
              <li>Clean URLs through your domain</li>
              <li>Secure (private S3 bucket)</li>
              <li>No manual signed URL generation needed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
