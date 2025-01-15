// export const createImage = url =>
//   new Promise((resolve, reject) => {
//     const image = new Image()
//     image.addEventListener('load', () => resolve(image))
//     image.addEventListener('error', error => reject(error))
//     image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
//     image.src = url
//   })

// export function getRadianAngle(degreeValue) {
//   return (degreeValue * Math.PI) / 180
// }

/**
 * Returns the new bounding area of a rotated rectangle.
 */
// export function rotateSize(width, height, rotation) {
//   const rotRad = getRadianAngle(rotation)

//   return {
//     width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
//     height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
//   }
// }

export const getCroppedImg = async (imageSrc: string, croppedAreaPixels: any): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

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

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.src = url
    image.onload = () => resolve(image)
    image.onerror = error => reject(error)
  })
