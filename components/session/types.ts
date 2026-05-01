export type UploadedFile = {
  id: string
  session_id: string
  uploaded_by: string
  file_path: string
  file_url: string
  file_type: 'pdf' | 'image' | 'other'
  file_name: string
  size_bytes: number | null
  created_at: string
}
