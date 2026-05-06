/**
 * TS bundler 해석 시 `firebase/storage` 타입이 잡히지 않는 환경 대비 최소 선언
 * (실제 API는 firebase 패키지와 동일)
 */
declare module 'firebase/storage' {
  export interface FirebaseStorage {}
  export interface StorageReference {}
  export function getStorage(app?: object): FirebaseStorage
  export function ref(storage: FirebaseStorage, path?: string): StorageReference
  export function uploadBytes(
    storageRef: StorageReference,
    data: Blob | Uint8Array | ArrayBuffer,
    metadata?: { contentType?: string },
  ): Promise<{ ref: StorageReference }>
  export function getDownloadURL(storageRef: StorageReference): Promise<string>
}
