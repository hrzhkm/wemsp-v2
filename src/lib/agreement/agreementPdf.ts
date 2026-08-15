type PdfAgreement = {
  id: string
  title: string
  description: string | null
  distributionType: string
  status: string
  effectiveDate: Date | string | null
  expiryDate: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  ownerHasSigned: boolean
  ownerSignedAt: Date | string | null
  ownerSignatureRef: string | null
  witnessedAt: Date | string | null
  witnessSignatureRef: string | null
  tokenId: number | null
  contractAddress: string | null
  metadataUri: string | null
  mintTxHash: string | null
  owner: {
    name: string | null
    email: string | null
  }
  witness: {
    name: string | null
    email: string | null
  } | null
  assets: Array<{
    allocatedValue: number | null
    allocatedPercentage: number | null
    notes: string | null
    asset: {
      name: string
      type: string
      description: string | null
      value: number
    }
  }>
  beneficiaries: Array<{
    sharePercentage: number
    shareDescription: string | null
    hasSigned: boolean
    signedAt: Date | string | null
    signatureRef: string | null
    isAccepted: boolean | null
    familyMember: {
      relation: string
      familyMemberUser: {
        name: string | null
        email: string | null
      }
    } | null
    nonRegisteredFamilyMember: {
      name: string
      relation: string
    } | null
  }>
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const LINE_HEIGHT = 15
const FONT_SIZE = 10
const TITLE_FONT_SIZE = 16
const MAX_TEXT_CHARS = 92

export function buildAgreementPdf(agreement: PdfAgreement): Buffer {
  const lines = buildAgreementDocumentLines(agreement)
  const pages = paginate(lines)
  const objects: Array<string> = []
  const helveticaObjectNumber = 3 + pages.length * 2
  const helveticaBoldObjectNumber = helveticaObjectNumber + 1

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')

  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2)
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((objectNumber) => `${objectNumber} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 3 + index * 2
    const contentObjectNumber = pageObjectNumber + 1
    const content = buildPageContent(pageLines, index + 1, pages.length)

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${helveticaObjectNumber} 0 R /F2 ${helveticaBoldObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    )
  })

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  return assemblePdf(objects)
}

function buildAgreementDocumentLines(
  agreement: PdfAgreement,
): Array<{ text: string; bold?: boolean; title?: boolean }> {
  const beneficiaryLines = agreement.beneficiaries.flatMap(
    (beneficiary, index) => {
      const name =
        beneficiary.familyMember?.familyMemberUser.name ||
        beneficiary.nonRegisteredFamilyMember?.name ||
        'Unknown beneficiary'
      const relation =
        beneficiary.familyMember?.relation ||
        beneficiary.nonRegisteredFamilyMember?.relation ||
        'N/A'
      const signedStatus = beneficiary.hasSigned
        ? `Signed ${formatDate(beneficiary.signedAt)}`
        : beneficiary.isAccepted === false
          ? 'Rejected'
          : 'Pending signature'

      return [
        line(
          `${index + 1}. ${name} (${relation}) - ${beneficiary.sharePercentage}% - ${signedStatus}`,
        ),
        ...(beneficiary.shareDescription
          ? [line(`   Share note: ${beneficiary.shareDescription}`)]
          : []),
        ...(beneficiary.signatureRef
          ? [line(`   Signature tx/reference: ${beneficiary.signatureRef}`)]
          : []),
      ]
    },
  )

  const assetLines = agreement.assets.flatMap((agreementAsset, index) => [
    line(
      `${index + 1}. ${agreementAsset.asset.name} (${agreementAsset.asset.type}) - MYR ${formatNumber(agreementAsset.asset.value)}`,
    ),
    ...(agreementAsset.allocatedValue !== null
      ? [
          line(
            `   Allocated value: MYR ${formatNumber(agreementAsset.allocatedValue)}`,
          ),
        ]
      : []),
    ...(agreementAsset.allocatedPercentage !== null
      ? [
          line(
            `   Allocated percentage: ${agreementAsset.allocatedPercentage}%`,
          ),
        ]
      : []),
    ...(agreementAsset.notes
      ? [line(`   Notes: ${agreementAsset.notes}`)]
      : []),
  ])

  return [
    line('WEMSP Agreement Document', true, true),
    line(agreement.title, true),
    line(
      'This generated document is an application record for review and audit. Islamic distribution outcomes may require qualified religious, legal, or administrative review.',
    ),
    blank(),
    heading('Agreement'),
    line(`Agreement ID: ${agreement.id}`),
    line(`Distribution type: ${agreement.distributionType}`),
    line(`Status: ${agreement.status}`),
    line(`Description: ${agreement.description || 'N/A'}`),
    line(`Effective date: ${formatDate(agreement.effectiveDate)}`),
    line(`Expiry date: ${formatDate(agreement.expiryDate)}`),
    line(`Created: ${formatDate(agreement.createdAt)}`),
    line(`Updated: ${formatDate(agreement.updatedAt)}`),
    blank(),
    heading('Parties'),
    line(
      `Owner: ${agreement.owner.name || 'N/A'} (${agreement.owner.email || 'N/A'})`,
    ),
    line(
      `Witness: ${agreement.witness?.name || 'Pending'} (${agreement.witness?.email || 'N/A'})`,
    ),
    blank(),
    heading('Assets'),
    ...(assetLines.length > 0 ? assetLines : [line('No assets recorded.')]),
    blank(),
    heading('Beneficiaries'),
    ...(beneficiaryLines.length > 0
      ? beneficiaryLines
      : [line('No beneficiaries recorded.')]),
    blank(),
    heading('Lifecycle Evidence'),
    line(
      `Owner signed: ${agreement.ownerHasSigned ? formatDate(agreement.ownerSignedAt) : 'No'}`,
    ),
    line(
      `Owner signature tx/reference: ${agreement.ownerSignatureRef || 'N/A'}`,
    ),
    line(
      `Witnessed: ${agreement.witnessedAt ? formatDate(agreement.witnessedAt) : 'No'}`,
    ),
    line(
      `Witness signature tx/reference: ${agreement.witnessSignatureRef || 'N/A'}`,
    ),
    line(`Token ID: ${agreement.tokenId ?? 'N/A'}`),
    line(`Contract address: ${agreement.contractAddress || 'N/A'}`),
    line(`Metadata URI: ${agreement.metadataUri || 'N/A'}`),
    line(`Mint tx: ${agreement.mintTxHash || 'N/A'}`),
  ].flatMap(wrapLine)
}

function heading(text: string) {
  return line(text, true)
}

function line(text: string, bold = false, title = false) {
  return { text, bold, title }
}

function blank() {
  return line('')
}

function wrapLine(input: { text: string; bold?: boolean; title?: boolean }) {
  if (input.text.length <= MAX_TEXT_CHARS || input.title) {
    return [input]
  }

  const words = input.text.split(/\s+/)
  const wrapped: Array<{ text: string; bold?: boolean; title?: boolean }> = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > MAX_TEXT_CHARS && current) {
      wrapped.push({ ...input, text: current })
      current = word
    } else {
      current = next
    }
  }

  if (current) {
    wrapped.push({ ...input, text: current })
  }

  return wrapped
}

function paginate(
  lines: Array<{ text: string; bold?: boolean; title?: boolean }>,
) {
  const linesPerPage = Math.floor((PAGE_HEIGHT - MARGIN * 2 - 24) / LINE_HEIGHT)
  const pages: Array<Array<{ text: string; bold?: boolean; title?: boolean }>> =
    []

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage))
  }

  return pages.length > 0 ? pages : [[line('')]]
}

function buildPageContent(
  lines: Array<{ text: string; bold?: boolean; title?: boolean }>,
  pageNumber: number,
  pageCount: number,
) {
  const commands = ['BT']
  let y = PAGE_HEIGHT - MARGIN

  for (const item of lines) {
    const font = item.bold || item.title ? 'F2' : 'F1'
    const size = item.title ? TITLE_FONT_SIZE : FONT_SIZE
    commands.push(`/${font} ${size} Tf`)
    commands.push(`${MARGIN} ${y} Td`)
    commands.push(`(${escapePdfText(item.text)}) Tj`)
    commands.push(`${-MARGIN} ${-LINE_HEIGHT} Td`)
    y -= LINE_HEIGHT
  }

  commands.push('/F1 8 Tf')
  commands.push(`${MARGIN} ${MARGIN - 18} Td`)
  commands.push(`(Page ${pageNumber} of ${pageCount}) Tj`)
  commands.push('ET')

  return commands.join('\n')
}

function assemblePdf(objects: Array<string>) {
  const objectBodies = objects.map((object, index) => {
    const objectNumber = index + 1
    return `${objectNumber} 0 obj\n${object}\nendobj\n`
  })

  const header = '%PDF-1.4\n'
  let offset = Buffer.byteLength(header, 'latin1')
  const offsets = [0]

  for (const body of objectBodies) {
    offsets.push(offset)
    offset += Buffer.byteLength(body, 'latin1')
  }

  const xrefOffset = offset
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets
      .slice(1)
      .map((item) => `${item.toString().padStart(10, '0')} 00000 n `),
  ].join('\n')

  const trailer = [
    '',
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')

  const pdf = `${header}${objectBodies.join('')}${xref}${trailer}`

  return Buffer.from(pdf, 'latin1')
}

function escapePdfText(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return 'N/A'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return date.toISOString().slice(0, 10)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-MY', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}
