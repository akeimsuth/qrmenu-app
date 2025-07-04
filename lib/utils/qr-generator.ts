import QRCode from "qrcode"

export async function generateQRCode(
  url: string,
  options?: {
    color?: { dark: string; light: string }
    width?: number
  },
): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url, {
      width: options?.width || 300,
      color: {
        dark: options?.color?.dark || "#000000",
        light: options?.color?.light || "#FFFFFF",
      },
      margin: 2,
    })
    return qrCodeDataURL
  } catch (error) {
    console.error("Error generating QR code:", error)
    throw error
  }
}
