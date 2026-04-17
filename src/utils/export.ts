import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'

export function exportJsonToExcel(name: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const now = dayjs().format('YYYYMMDD_HHmmss')
  saveAs(new Blob([output], { type: 'application/octet-stream' }), `${name}_${now}.xlsx`)
}

export async function exportElementToPdf(name: string, element: HTMLElement) {
  const canvas = await html2canvas(element, { scale: 2 })
  const data = canvas.toDataURL('image/png')
  const pdf = new jsPDF('l', 'mm', 'a4')
  const width = 280
  const height = (canvas.height / canvas.width) * width
  pdf.addImage(data, 'PNG', 8, 8, width, height)
  pdf.save(`${name}_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`)
}
