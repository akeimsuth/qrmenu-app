"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, QrCode, Share2, Crown, ExternalLink, Upload, Link, X } from "lucide-react"
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Restaurant, Menu } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { generateQRCode } from "@/lib/utils/qr-generator"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const restaurantId = params.id as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  // Form states
  const [newSection, setNewSection] = useState({ name: "" })
  const [newItem, setNewItem] = useState({
    name: "",
    price: 0,
    description: "",
    sectionId: "",
    imageUrl: "",
    imageType: "upload" as "upload" | "url",
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)

  useEffect(() => {
    loadRestaurantData()
  }, [restaurantId])

  const loadRestaurantData = async () => {
    try {
      // Load restaurant
      const restaurantDoc = await getDoc(doc(db, "restaurants", restaurantId))
      if (restaurantDoc.exists()) {
        const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant
        setRestaurant(restaurantData)

        // Generate QR code
        const menuUrl = `${window.location.origin}/r/${restaurantData.slug}`
        const qrCode = await generateQRCode(menuUrl, {
          color: { dark: restaurantData.themeColor, light: "#FFFFFF" },
        })
        setQrCodeUrl(qrCode)
      }

      // Load menu
      const menuQuery = query(collection(db, "menus"), where("restaurantId", "==", restaurantId))
      const menuSnapshot = await getDocs(menuQuery)
      if (!menuSnapshot.empty) {
        const menuData = { id: menuSnapshot.docs[0].id, ...menuSnapshot.docs[0].data() } as Menu
        setMenu(menuData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load restaurant data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const createMenu = async () => {
    if (!restaurant) return

    try {
      const menuData = {
        restaurantId,
        sections: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const docRef = await addDoc(collection(db, "menus"), menuData)
      setMenu({ id: docRef.id, ...menuData })

      toast({
        title: "Menu created!",
        description: "You can now add sections and items to your menu.",
      })
    } catch (error) {
      console.error("Error creating menu:", error)
      toast({
        title: "Error",
        description: "Failed to create menu",
        variant: "destructive",
      })
    }
  }

  const addSection = async () => {
    if (!menu || !newSection.name.trim()) return

    try {
      const updatedSections = [
        ...menu.sections,
        {
          id: Date.now().toString(),
          name: newSection.name,
          items: [],
        },
      ]

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })
      setNewSection({ name: "" })

      toast({
        title: "Section added!",
        description: `${newSection.name} has been added to your menu.`,
      })
    } catch (error) {
      console.error("Error adding section:", error)
      toast({
        title: "Error",
        description: "Failed to add section",
        variant: "destructive",
      })
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const imageRef = ref(storage, `menu-items/${Date.now()}-${file.name}`)
    await uploadBytes(imageRef, file)
    return await getDownloadURL(imageRef)
  }

  const handleImageChange = (file: File | null) => {
    setSelectedImage(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview("")
    }
  }

  const addItem = async () => {
    if (!menu || !newItem.name.trim() || !newItem.sectionId) return

    try {
      let finalImageUrl = ""

      if (newItem.imageType === "upload" && selectedImage) {
        finalImageUrl = await uploadImage(selectedImage)
      } else if (newItem.imageType === "url" && newItem.imageUrl.trim()) {
        finalImageUrl = newItem.imageUrl.trim()
      }

      const updatedSections = menu.sections.map((section) => {
        if (section.id === newItem.sectionId) {
          return {
            ...section,
            items: [
              ...section.items,
              {
                id: Date.now().toString(),
                name: newItem.name,
                price: newItem.price,
                description: newItem.description,
                imageUrl: finalImageUrl,
                imageType: newItem.imageType,
              },
            ],
          }
        }
        return section
      })

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })
      setNewItem({ name: "", price: 0, description: "", sectionId: "", imageUrl: "", imageType: "upload" })
      setSelectedImage(null)
      setImagePreview("")

      toast({
        title: "Item added!",
        description: `${newItem.name} has been added to your menu.`,
      })
    } catch (error) {
      console.error("Error adding item:", error)
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      })
    }
  }

  const shareWhatsApp = () => {
    if (!restaurant) return

    const menuUrl = `${window.location.origin}/r/${restaurant.slug}`
    const message = `Check out our menu at ${restaurant.name}! ${menuUrl}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Restaurant not found</h1>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <QrCode className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
                <p className="text-sm text-gray-600">{restaurant.location}</p>
              </div>
              {!restaurant.isPremium && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Free Plan
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Menu Views</p>
                <p className="text-2xl font-bold text-blue-600">{restaurant.menuViews}</p>
              </div>
              {!restaurant.isPremium && (
                <Button
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* QR Code & Sharing */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your QR Code</CardTitle>
                <CardDescription>Share this QR code with your customers</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                {qrCodeUrl && <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="mx-auto w-48 h-48" />}
                <div className="space-y-2">
                  <Button onClick={shareWhatsApp} className="w-full bg-green-600 hover:bg-green-700">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share on WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => window.open(`/r/${restaurant.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Public Menu
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Menu URL: {window.location.origin}/r/{restaurant.slug}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Menu Management */}
          <div className="lg:col-span-2">
            {!menu ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create Your Menu</CardTitle>
                  <CardDescription>Get started by creating your first menu</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={createMenu} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Menu
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Add Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Add Menu Section</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Section name (e.g., Appetizers, Main Courses)"
                        value={newSection.name}
                        onChange={(e) => setNewSection({ name: e.target.value })}
                      />
                      <Button onClick={addSection}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Menu Sections */}
                {menu.sections.map((section) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{section.name}</CardTitle>
                        <Badge variant="secondary">{section.items.length} items</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Add Item Form */}
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-medium mb-3">Add Item to {section.name}</h4>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <Input
                            placeholder="Item name"
                            value={newItem.sectionId === section.id ? newItem.name : ""}
                            onChange={(e) =>
                              setNewItem({
                                ...newItem,
                                name: e.target.value,
                                sectionId: section.id,
                              })
                            }
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            value={newItem.sectionId === section.id ? newItem.price : 0}
                            onChange={(e) =>
                              setNewItem({
                                ...newItem,
                                price: Number.parseFloat(e.target.value) || 0,
                                sectionId: section.id,
                              })
                            }
                          />
                        </div>

                        <Textarea
                          placeholder="Description (optional)"
                          className="mb-4"
                          value={newItem.sectionId === section.id ? newItem.description : ""}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              description: e.target.value,
                              sectionId: section.id,
                            })
                          }
                        />

                        {/* Image Section */}
                        {newItem.sectionId === section.id && (
                          <div className="mb-4">
                            <Label className="text-sm font-medium mb-2 block">Item Image (Optional)</Label>
                            <Tabs
                              value={newItem.imageType}
                              onValueChange={(value) =>
                                setNewItem({ ...newItem, imageType: value as "upload" | "url" })
                              }
                            >
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upload" className="flex items-center gap-2">
                                  <Upload className="h-4 w-4" />
                                  Upload
                                </TabsTrigger>
                                <TabsTrigger value="url" className="flex items-center gap-2">
                                  <Link className="h-4 w-4" />
                                  URL
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="upload" className="mt-3">
                                <div className="space-y-3">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                                    className="cursor-pointer"
                                  />
                                  {imagePreview && (
                                    <div className="relative inline-block">
                                      <img
                                        src={imagePreview || "/placeholder.svg"}
                                        alt="Preview"
                                        className="w-24 h-24 object-cover rounded-lg border"
                                      />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                        onClick={() => {
                                          setSelectedImage(null)
                                          setImagePreview("")
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="url" className="mt-3">
                                <div className="space-y-3">
                                  <Input
                                    placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                                    value={newItem.imageUrl}
                                    onChange={(e) => setNewItem({ ...newItem, imageUrl: e.target.value })}
                                  />
                                  {newItem.imageUrl && (
                                    <div className="relative inline-block">
                                      <img
                                        src={newItem.imageUrl || "/placeholder.svg"}
                                        alt="Preview"
                                        className="w-24 h-24 object-cover rounded-lg border"
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none"
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        )}

                        <Button
                          onClick={addItem}
                          disabled={!newItem.name || newItem.sectionId !== section.id}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2">
                        {section.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-4 p-3 border rounded-lg">
                            {/* Item Image */}
                            {item.imageUrl && (
                              <div className="flex-shrink-0">
                                <img
                                  src={item.imageUrl || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded-lg border"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              </div>
                            )}

                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-lg">{item.name}</h5>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                                  )}
                                </div>
                                <span className="font-bold text-green-600 text-lg ml-4 flex-shrink-0">
                                  ${item.price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Premium Modal */}
      <Dialog open={showPremiumModal} onOpenChange={setShowPremiumModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-500" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription>Unlock advanced features for your restaurant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Premium Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Unlimited menus</li>
                <li>• Advanced analytics</li>
                <li>• Custom branding</li>
                <li>• Priority support</li>
                <li>• Printable flyers</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">$9.99/month</p>
              <p className="text-sm text-gray-600">Cancel anytime</p>
            </div>
            <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">Start Premium Trial</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
