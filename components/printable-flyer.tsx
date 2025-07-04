"use client"

import type { Restaurant } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, QrCode } from "lucide-react"

interface PrintableeFlyerProps {
  restaurant: Restaurant
  qrCodeUrl: string
}

export function PrintableFlyer({ restaurant, qrCodeUrl }: PrintableeFlyerProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const flyerHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${restaurant.name} - QR Menu Flyer</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
            }
            .flyer {
              max-width: 8.5in;
              margin: 0 auto;
              text-align: center;
              border: 2px solid ${restaurant.themeColor};
              padding: 40px;
              border-radius: 10px;
            }
            .logo {
              width: 100px;
              height: 100px;
              margin: 0 auto 20px;
              border-radius: 50%;
            }
            .restaurant-name {
              font-size: 36px;
              font-weight: bold;
              color: ${restaurant.themeColor};
              margin-bottom: 10px;
            }
            .location {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            .qr-section {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 10px;
              margin: 30px 0;
            }
            .qr-code {
              width: 200px;
              height: 200px;
              margin: 0 auto 20px;
            }
            .scan-text {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .url {
              font-size: 16px;
              color: #666;
              word-break: break-all;
            }
            .footer {
              margin-top: 30px;
              font-size: 14px;
              color: #999;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .flyer { border: 2px solid ${restaurant.themeColor}; }
            }
          </style>
        </head>
        <body>
          <div class="flyer">
            ${restaurant.logoUrl ? `<img src="${restaurant.logoUrl}" alt="${restaurant.name}" class="logo" />` : ""}
            <div class="restaurant-name">${restaurant.name}</div>
            <div class="location">${restaurant.location}</div>
            
            <div class="qr-section">
              <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
              <div class="scan-text">Scan for Our Menu</div>
              <div class="url">${window.location.origin}/r/${restaurant.slug}</div>
            </div>
            
            <div style="font-size: 18px; color: ${restaurant.themeColor};">
              <strong>Safe • Contactless • Always Updated</strong>
            </div>
            
            <div class="footer">
              Powered by QRMenu
            </div>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(flyerHTML)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <QrCode className="h-12 w-12 mx-auto text-blue-600" />
          <h3 className="text-lg font-semibold">Printable Flyer</h3>
          <p className="text-sm text-gray-600">
            Generate a printable flyer with your QR code to display in your restaurant
          </p>
          <Button onClick={handlePrint} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Generate & Print Flyer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
