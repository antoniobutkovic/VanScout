// Four images at this size, plus form fields and multipart overhead, fit below
// Vercel's 4.5 MB function request limit.
export const PROFILE_IMAGE_UPLOAD_LIMIT = 800 * 1024;

export async function prepareProfileImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("invalid_image");
  if (file.size <= PROFILE_IMAGE_UPLOAD_LIMIT) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("image_processing_unavailable");
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("invalid_image");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_processing_unavailable");
    let scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.5, 0.88 - attempt * 0.07);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= PROFILE_IMAGE_UPLOAD_LIMIT) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      }
      scale *= 0.8;
    }
    throw new Error("image_too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
