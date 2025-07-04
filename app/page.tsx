"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, QrCode, Eye, Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { collection, addDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

export default function HomePage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    location: "",
    themeColor: "#3B82F6",
  })
  const [logo, setLogo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let logoUrl = ""

      if (logo) {
        const logoRef = ref(storage, `logos/${Date.now()}-${logo.name}`)
        await uploadBytes(logoRef, logo)
        logoUrl = await getDownloadURL(logoRef)
      }

      const slug = generateSlug(formData.name)

      const restaurantData = {
        name: formData.name,
        email: formData.email,
        location: formData.location,
        logoUrl,
        slug,
        themeColor: formData.themeColor,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        menuViews: 0,
      }

      const docRef = await addDoc(collection(db, "restaurants"), restaurantData)

      toast({
        title: "Restaurant created successfully!",
        description: "You can now create your menu.",
      })

      router.push(`/dashboard/${docRef.id}`)
    } catch (error) {
      console.error("Error creating restaurant:", error)
      toast({
        title: "Error",
        description: "Failed to create restaurant. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QrCode className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">QRMenu</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Create QR Code Menus for Your Restaurant</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Help your customers browse your menu safely with contactless QR codes. No technical knowledge required - get
            started in minutes!
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <QrCode className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">QR Code Generation</h3>
              <p className="text-gray-600">Instantly generate branded QR codes for your menu</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Mobile Optimized</h3>
              <p className="text-gray-600">Beautiful menus that work perfectly on any device</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Eye className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Analytics</h3>
              <p className="text-gray-600">Track menu views and customer engagement</p>
            </div>
          </div>
        </div>

        {/* Onboarding Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Get Started - Create Your Restaurant</CardTitle>
              <CardDescription>Fill in your restaurant details to create your first QR menu</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Mario's Pizza"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="owner@restaurant.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="123 Main St, City, State"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Restaurant Logo (Optional)</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogo(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    <Upload className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="themeColor">Theme Color</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="themeColor"
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      className="w-20 h-10"
                    />
                    <span className="text-sm text-gray-600">Choose your brand color</span>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Restaurant..." : "Create Restaurant & Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
