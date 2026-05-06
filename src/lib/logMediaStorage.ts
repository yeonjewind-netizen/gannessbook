import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from './firebase'

function storageFileExtension(file: File): string {
  const name = file.name
  const dot = name.lastIndexOf('.')
  if (dot >= 0 && dot < name.length - 1) {
    const ext = name
      .slice(dot + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    if (ext) return `.${ext.slice(0, 16)}`
  }
  if (file.type.startsWith('video/')) {
    if (file.type.includes('webm')) return '.webm'
    if (file.type.includes('mp4')) return '.mp4'
    return '.mp4'
  }
  if (file.type === 'image/png') return '.png'
  if (file.type === 'image/gif') return '.gif'
  if (file.type === 'image/webp') return '.webp'
  return '.jpg'
}

/**
 * 일지 첨부를 Storage에 올리고 다운로드 URL을 반환합니다.
 * 경로: users/{uid}/diary_logs/{logEntryId}/{attachmentId}{ext}
 */
export async function uploadDiaryAttachment(
  uid: string,
  logEntryId: string,
  attachmentId: string,
  file: File,
): Promise<string> {
  const storage = getFirebaseStorage()
  const ext = storageFileExtension(file)
  const path = `users/${uid}/diary_logs/${logEntryId}/${attachmentId}${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined,
  })
  return getDownloadURL(storageRef)
}
