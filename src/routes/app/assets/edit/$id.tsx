import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, DollarSign, ExternalLink, FileText, Loader2, Package, PencilLine, RefreshCw, Tag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AssetType as AssetTypeEnum } from '@/generated/prisma/enums'
import type { Asset } from '@/components/assets/assets-table'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AssetType } from '@/generated/prisma/enums'

const formatAssetType = (type: string) =>
  type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const formatValueWithCommas = (value: string) => {
  const clean = value.replace(/,/g, '')
  if (!clean) return ''
  if (!/^\d*\.?\d*$/.test(clean)) return value
  const parts = clean.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

const cleanValue = (value: string) => value.replace(/,/g, '')

export const Route = createFileRoute('/app/assets/edit/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = Route.useParams()

  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<{
    description: string
    name: string
    type: AssetTypeEnum | undefined
    value: string
  }>({
    description: '',
    name: '',
    type: undefined,
    value: '',
  })
  const [showReplaceDocument, setShowReplaceDocument] = useState(false)

  const { data: assetData, isLoading: assetLoading } = useQuery<{ asset: Asset }>({
    enabled: !!id,
    queryKey: ['asset', id],
    queryFn: async () => {
      const response = await fetch(`/api/asset/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch asset')
      }
      return response.json()
    },
  })

  const asset = assetData?.asset

  useEffect(() => {
    if (!asset) return
    setFormData({
      description: asset.description || '',
      name: asset.name,
      type: asset.type as AssetTypeEnum,
      value: formatValueWithCommas(asset.value.toString()),
    })
  }, [asset])

  const updateAssetMutation = useMutation({
    mutationFn: async () => {
      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      if (formData.type) {
        formDataToSend.append('type', formData.type)
      }
      if (formData.description) {
        formDataToSend.append('description', formData.description)
      }
      formDataToSend.append('value', cleanValue(formData.value))
      if (documentFile) {
        formDataToSend.append('document', documentFile)
      }

      const response = await fetch(`/api/asset/${id}`, {
        body: formDataToSend,
        method: 'PUT',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update asset')
      }
      return data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update asset')
    },
    onSuccess: () => {
      toast.success('Asset updated successfully')
      queryClient.invalidateQueries({ queryKey: ['asset', id] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      router.navigate({ to: '/app/assets' })
    },
  })

  const handleValueChange = (value: string) => {
    const numericValue = value.replace(/[^\d.,]/g, '')
    if (numericValue.split('.').length > 2) return
    setFormData((prev) => ({ ...prev, value: formatValueWithCommas(numericValue) }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Invalid file type. Please upload PDF files.')
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size exceeds 10MB limit')
      return
    }

    setDocumentFile(file)
    setShowReplaceDocument(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!formData.type) {
      toast.error('Asset type is required')
      return
    }
    if (!formData.value.trim()) {
      toast.error('Value is required')
      return
    }

    const numericValue = parseFloat(cleanValue(formData.value))
    if (Number.isNaN(numericValue) || numericValue < 0) {
      toast.error('Value must be a positive number')
      return
    }

    updateAssetMutation.mutate()
  }

  if (assetLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!asset) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Asset not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.navigate({ to: '/app/assets' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Assets
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-slate-100/70 via-background to-sky-50/50">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PencilLine className="h-5 w-5" />
              Edit Asset
            </CardTitle>
            <CardDescription className="mt-1">Update details and replace the document if needed.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.navigate({ to: '/app/assets' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Assets
          </Button>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup className="gap-4 md:grid md:grid-cols-2">
              <Field className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="name">Asset Name *</FieldLabel>
                <div className="relative">
                  <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter asset name"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2">
                <FieldLabel htmlFor="type">Asset Type *</FieldLabel>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as AssetTypeEnum }))}
                  >
                    <SelectTrigger id="type" className="pl-10">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(AssetType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatAssetType(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>

              <Field className="space-y-2">
                <FieldLabel htmlFor="value">Value (MYR) *</FieldLabel>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="value"
                    value={formData.value}
                    onChange={(event) => handleValueChange(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Optional description"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2 md:col-span-2">
                <FieldLabel>Document (PDF)</FieldLabel>
                {asset.documentUrl && !showReplaceDocument && !documentFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Current document</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => window.open(asset.documentUrl as string, '_blank')}
                      >
                        View document
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowReplaceDocument(true)}>
                      <RefreshCw className="h-4 w-4" />
                      Replace
                    </Button>
                  </div>
                ) : documentFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{documentFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(documentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => {
                      setDocumentFile(null)
                      setShowReplaceDocument(false)
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      id="document"
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf"
                      className="file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">PDF only, maximum 10MB.</p>
                  </div>
                )}
              </Field>
            </FieldGroup>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.navigate({ to: '/app/assets' })}
                disabled={updateAssetMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAssetMutation.isPending}>
                {updateAssetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
