/**
 * Analyzes a cropped image to detect if it's almost entirely white or black.
 * Useful to warn users when a logo with transparency results in an invisible image.
 * Returns 'too-white' | 'too-dark' | 'ok'
 */
export async function analyzeImageContrast(blobUrl: string): Promise<'too-white' | 'too-dark' | 'ok'> {
  const img = await createImage(blobUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const totalPixels = canvas.width * canvas.height
  let whiteCount = 0
  let blackCount = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (r > 240 && g > 240 && b > 240) whiteCount++
    if (r < 15 && g < 15 && b < 15) blackCount++
  }

  if (whiteCount / totalPixels > 0.97) return 'too-white'
  if (blackCount / totalPixels > 0.97) return 'too-dark'
  return 'ok'
}

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
    image.onload = () => resolve(image)
    image.onerror = error => reject(error)
  })

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
function rotateSize(width: number, height: number, rotation: number): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * Original getCroppedImg without rotation support (for backward compatibility)
 */
export const getCroppedImg = async (imageSrc: string, croppedAreaPixels: any): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  // Fill with white background before drawing — JPEG doesn't support transparency,
  // so transparent PNG pixels would become black without this
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(URL.createObjectURL(blob))
      } else {
        reject(new Error('Failed to create blob'))
      }
    }, 'image/jpeg')
  })
}

/**
 * Enhanced getCroppedImg with rotation support
 * This is the professional version used by companies like Canva, Figma, etc.
 */
export const getCroppedImgWithRotation = async (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const rotRad = getRadianAngle(rotation)

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // Translate canvas context to the center to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // Draw rotated image
  ctx.drawImage(image, 0, 0)

  // Extract the cropped image using a second canvas
  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) {
    throw new Error('No 2d context')
  }

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width
  croppedCanvas.height = pixelCrop.height

  // Fill with white background before drawing — JPEG doesn't support transparency,
  // so transparent PNG pixels would become black without this
  croppedCtx.fillStyle = '#FFFFFF'
  croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height)

  // Draw the cropped portion
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // Return as blob URL
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      blob => {
        if (blob) {
          resolve(URL.createObjectURL(blob))
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      'image/jpeg',
      0.95 // High quality JPEG
    )
  })
}
