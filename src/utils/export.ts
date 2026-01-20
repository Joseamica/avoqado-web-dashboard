// src/utils/export.ts

import ExcelJS from 'exceljs'
import Papa from 'papaparse'

function triggerDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data to CSV format
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 */
export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Convert data to CSV using PapaParse
  const csv = Papa.unparse(data, {
    quotes: true, // Quote all fields
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\n',
  })

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename}.csv`)
}

/**
 * Export data to Excel format (.xlsx)
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 * @param sheetName Name of the worksheet
 */
export async function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName: string = 'Data',
): Promise<void> {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Create a new workbook and worksheet
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  // Auto-size columns
  const maxWidth = 50

  // Get headers from first row
  const headers = Object.keys(data[0])

  const colWidths = headers.map(header => {
    let maxLen = header.length
    data.forEach(row => {
      const cellValue = String(row[header] ?? '')
      maxLen = Math.max(maxLen, cellValue.length)
    })
    return Math.min(maxLen + 2, maxWidth)
  })

  worksheet.columns = headers.map((header, index) => ({
    header,
    width: colWidths[index],
  }))

  data.forEach(row => {
    worksheet.addRow(headers.map(header => row[header]))
  })

  // Generate Excel file and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, `${filename}.xlsx`)
}

/**
 * Generate filename with timestamp
 * @param prefix Filename prefix (e.g., 'payments', 'orders')
 * @param venueName Optional venue name/slug
 * @returns Filename with timestamp
 */
export function generateFilename(prefix: string, venueName?: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  if (venueName) {
    return `${prefix}-${venueName}-${dateStr}`
  }

  return `${prefix}-${dateStr}`
}

/**
 * Format date for export (YYYY-MM-DD HH:mm:ss)
 * @param dateString ISO date string
 * @returns Formatted date string
 */
export function formatDateForExport(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Format currency for export (removes currency symbol, keeps number)
 * @param amount Amount in pesos (e.g., 129.50 = $129.50)
 *   NOTE: Database values are stored in PESOS, not centavos.
 * @returns Formatted number string
 */
export function formatCurrencyForExport(amount: number): string {
  return Number(amount).toFixed(2)
}
