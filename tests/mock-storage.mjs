export async function downloadFile() {
  return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
}
export async function putFile() {}
export async function removeFile() {}
