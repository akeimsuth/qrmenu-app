"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, QrCode, Share2, Crown, ExternalLink, Upload, Link, X, Edit2, Save, Trash2 } from "lucide-react"
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Restaurant, Menu } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { generateQRCode } from "@/lib/utils/qr-generator"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { createCheckoutSession } from "@/lib/stripe"
import { PrintableFlyer } from "@/components/printable-flyer"

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
  const [showCustomizationModal, setShowCustomizationModal] = useState(false)

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
  const [editingSectionName, setEditingSectionName] = useState("")
  const [editingItemData, setEditingItemData] = useState({
    name: "",
    price: 0,
    description: "",
    imageUrl: "",
  })

  // Premium customization states
  const [customizationData, setCustomizationData] = useState({
    name: "",
    location: "",
    themeColor: "#3B82F6",
    logoUrl: "",
  })
  const [newLogo, setNewLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [showMenuSettingsModal, setShowMenuSettingsModal] = useState(false)
  const [menuSettings, setMenuSettings] = useState({
    showPrices: true,
    showDescriptions: true,
    showImages: true,
    allowSharing: true,
    customFooter: "",
  })

  useEffect(() => {
    loadRestaurantData()
  }, [restaurantId])

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')
    const trial = urlParams.get('trial')

    if (success === 'true' && trial === 'true') {
      toast({
        title: "Premium Trial Started! 🎉",
        description: "Your 7-day free trial has begun. You can cancel anytime before the trial ends.",
      })
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (canceled === 'true') {
      toast({
        title: "Trial Cancelled",
        description: "You can start your premium trial anytime from the upgrade button.",
        variant: "destructive",
      })
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [toast])

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

  const handleStartPremiumTrial = async () => {
    if (!restaurant) return

    try {
      const sessionUrl = await createCheckoutSession(restaurant.id)
      if (sessionUrl) {
        window.location.href = sessionUrl
      } else {
        toast({
          title: "Error",
          description: "Failed to start premium trial",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error starting premium trial:", error)
      toast({
        title: "Error",
        description: "Failed to start premium trial",
        variant: "destructive",
      })
    }
  }

  const openCustomizationModal = () => {
    if (!restaurant) return
    setCustomizationData({
      name: restaurant.name,
      location: restaurant.location,
      themeColor: restaurant.themeColor,
      logoUrl: restaurant.logoUrl || "",
    })
    setLogoPreview(restaurant.logoUrl || "")
    setShowCustomizationModal(true)
  }

  const handleLogoChange = (file: File | null) => {
    setNewLogo(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setLogoPreview(customizationData.logoUrl)
    }
  }

  const uploadLogo = async (file: File): Promise<string> => {
    const logoRef = ref(storage, `logos/${Date.now()}-${file.name}`)
    await uploadBytes(logoRef, file)
    return await getDownloadURL(logoRef)
  }

  const updateRestaurantCustomization = async () => {
    if (!restaurant) return
    setIsUpdating(true)

    try {
      let finalLogoUrl = customizationData.logoUrl

      if (newLogo) {
        finalLogoUrl = await uploadLogo(newLogo)
      }

      const updatedData = {
        name: customizationData.name,
        location: customizationData.location,
        themeColor: customizationData.themeColor,
        logoUrl: finalLogoUrl,
        updatedAt: new Date(),
      }

      await updateDoc(doc(db, "restaurants", restaurant.id), updatedData)
      
      // Update local state
      setRestaurant({ ...restaurant, ...updatedData })
      
      // Regenerate QR code with new theme color
      const menuUrl = `${window.location.origin}/r/${restaurant.slug}`
      const qrCode = await generateQRCode(menuUrl, {
        color: { dark: customizationData.themeColor, light: "#FFFFFF" },
      })
      setQrCodeUrl(qrCode)

      toast({
        title: "Restaurant Updated!",
        description: "Your restaurant details have been updated successfully.",
      })

      setShowCustomizationModal(false)
    } catch (error) {
      console.error("Error updating restaurant:", error)
      toast({
        title: "Error",
        description: "Failed to update restaurant details",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const openMenuSettingsModal = () => {
    if (!menu) return
    setMenuSettings({
      showPrices: menu.showPrices !== false,
      showDescriptions: menu.showDescriptions !== false,
      showImages: menu.showImages !== false,
      allowSharing: menu.allowSharing !== false,
      customFooter: menu.customFooter || "",
    })
    setShowMenuSettingsModal(true)
  }

  const updateMenuSettings = async () => {
    if (!menu) return
    setIsUpdating(true)

    try {
      const updatedMenuData = {
        ...menu,
        showPrices: menuSettings.showPrices,
        showDescriptions: menuSettings.showDescriptions,
        showImages: menuSettings.showImages,
        allowSharing: menuSettings.allowSharing,
        customFooter: menuSettings.customFooter,
        updatedAt: new Date(),
      }

      await updateDoc(doc(db, "menus", menu.id), updatedMenuData)
      setMenu(updatedMenuData)

      toast({
        title: "Menu Settings Updated!",
        description: "Your menu display options have been updated successfully.",
      })

      setShowMenuSettingsModal(false)
    } catch (error) {
      console.error("Error updating menu settings:", error)
      toast({
        title: "Error",
        description: "Failed to update menu settings",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const startEditingSection = (sectionId: string, currentName: string) => {
    setEditingSection(sectionId)
    setEditingSectionName(currentName)
  }

  const saveSectionEdit = async () => {
    if (!menu || !editingSection || !editingSectionName.trim()) return

    try {
      const updatedSections = menu.sections.map((section) =>
        section.id === editingSection
          ? { ...section, name: editingSectionName.trim() }
          : section
      )

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })
      setEditingSection(null)
      setEditingSectionName("")

      toast({
        title: "Section Updated!",
        description: "Section name has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating section:", error)
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      })
    }
  }

  const cancelSectionEdit = () => {
    setEditingSection(null)
    setEditingSectionName("")
  }

  const deleteSection = async (sectionId: string) => {
    if (!menu) return

    try {
      const updatedSections = menu.sections.filter((section) => section.id !== sectionId)

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })

      toast({
        title: "Section Deleted!",
        description: "Section has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting section:", error)
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      })
    }
  }

  const startEditingItem = (item: any) => {
    setEditingItem(item.id)
    setEditingItemData({
      name: item.name,
      price: item.price,
      description: item.description || "",
      imageUrl: item.imageUrl || "",
    })
  }

  const saveItemEdit = async () => {
    if (!menu || !editingItem || !editingItemData.name.trim()) return

    try {
      const updatedSections = menu.sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === editingItem
            ? {
                ...item,
                name: editingItemData.name.trim(),
                price: editingItemData.price,
                description: editingItemData.description,
                imageUrl: editingItemData.imageUrl,
              }
            : item
        ),
      }))

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })
      setEditingItem(null)
      setEditingItemData({ name: "", price: 0, description: "", imageUrl: "" })

      toast({
        title: "Item Updated!",
        description: "Menu item has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating item:", error)
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      })
    }
  }

  const cancelItemEdit = () => {
    setEditingItem(null)
    setEditingItemData({ name: "", price: 0, description: "", imageUrl: "" })
  }

  const deleteItem = async (sectionId: string, itemId: string) => {
    if (!menu) return

    try {
      const updatedSections = menu.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter((item) => item.id !== itemId),
            }
          : section
      )

      await updateDoc(doc(db, "menus", menu.id), {
        sections: updatedSections,
        updatedAt: new Date(),
      })

      setMenu({ ...menu, sections: updatedSections })

      toast({
        title: "Item Deleted!",
        description: "Menu item has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting item:", error)
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      })
    }
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
              {restaurant.isPremium ? (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              ) : (
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
              {/* {!restaurant.isPremium && (
                <Button
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )} */}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Features Summary */}
        {restaurant.isPremium && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Premium Features Active</h2>
                      <p className="text-gray-600">You have access to all premium features</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Premium Plan</p>
                    <p className="text-lg font-bold text-purple-600">$9.99/month</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-purple-200">
                  <div className="text-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <p className="text-xs text-gray-600">Printable Flyers</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <p className="text-xs text-gray-600">Advanced Analytics</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <p className="text-xs text-gray-600">Custom Branding</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <p className="text-xs text-gray-600">Priority Support</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* QR Code & Sharing */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
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

              {/* Premium Features */}
              {restaurant.isPremium && (
                <>
                  {/* Printable Flyer */}
                  <PrintableFlyer restaurant={restaurant} qrCodeUrl={qrCodeUrl} />
                  
                  {/* Advanced Analytics */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                          <span className="text-purple-600 text-xl">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold">Advanced Analytics</h3>
                        <p className="text-sm text-gray-600">
                          Track customer engagement and menu performance
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-blue-600">{restaurant.menuViews}</p>
                            <p className="text-xs text-gray-600">Total Views</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-600">
                              {menu ? menu.sections.reduce((acc, section) => acc + section.items.length, 0) : 0}
                            </p>
                            <p className="text-xs text-gray-600">Menu Items</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Custom Branding */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                          <span className="text-orange-600 text-xl">🎨</span>
                        </div>
                        <h3 className="text-lg font-semibold">Custom Branding</h3>
                        <p className="text-sm text-gray-600">
                          Your menu is branded with your restaurant's colors
                        </p>
                        <div className="flex items-center justify-center space-x-2 mb-4">
                          <div 
                            className="w-6 h-6 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: restaurant.themeColor }}
                          ></div>
                          <span className="text-sm text-gray-600">Theme Color: {restaurant.themeColor}</span>
                        </div>
                        <Button 
                          onClick={openCustomizationModal}
                          variant="outline" 
                          className="w-full"
                        >
                          <span className="text-sm">Customize Branding</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Menu Settings */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                          <span className="text-green-600 text-xl">⚙️</span>
                        </div>
                        <h3 className="text-lg font-semibold">Menu Settings</h3>
                        <p className="text-sm text-gray-600">
                          Customize how your menu is displayed
                        </p>
                        <Button 
                          onClick={openMenuSettingsModal}
                          variant="outline" 
                          className="w-full"
                          disabled={!menu}
                        >
                          <span className="text-sm">Configure Menu</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Priority Support */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                          <span className="text-blue-600 text-xl">🎯</span>
                        </div>
                        <h3 className="text-lg font-semibold">Priority Support</h3>
                        <p className="text-sm text-gray-600">
                          Get help when you need it most
                        </p>
                        <Button variant="outline" className="w-full">
                          <span className="text-sm">Contact Support</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Free Plan Upgrade Prompt */}
              {!restaurant.isPremium && (
                <Card className="border-2 border-dashed border-orange-300 bg-orange-50">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <Crown className="h-12 w-12 mx-auto text-orange-500" />
                      <h3 className="text-lg font-semibold text-orange-800">Unlock Premium Features</h3>
                      <p className="text-sm text-orange-700">
                        Get access to printable flyers, advanced analytics, custom branding, and priority support
                      </p>
                      <Button 
                        onClick={() => setShowPremiumModal(true)}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
                    <div className="flex items-center justify-between">
                      <CardTitle>Add Menu Section</CardTitle>
                      {restaurant.isPremium && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Unlimited
                        </Badge>
                      )}
                    </div>
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
                    {!restaurant.isPremium && (
                      <p className="text-xs text-gray-500 mt-2">
                        Free plan: Limited sections. <button 
                          onClick={() => setShowPremiumModal(true)}
                          className="text-blue-600 hover:underline"
                        >
                          Upgrade for unlimited
                        </button>
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Menu Sections */}
                {menu.sections.map((section) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {editingSection === section.id ? (
                            <div className="flex items-center space-x-2">
                              <Input
                                value={editingSectionName}
                                onChange={(e) => setEditingSectionName(e.target.value)}
                                className="w-48"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveSectionEdit()
                                  if (e.key === "Escape") cancelSectionEdit()
                                }}
                              />
                              <Button size="sm" onClick={saveSectionEdit}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelSectionEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <CardTitle>{section.name}</CardTitle>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{section.items.length} items</Badge>
                          {restaurant.isPremium && (
                            <>
                              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                <Crown className="h-3 w-3 mr-1" />
                                Unlimited
                              </Badge>
                              {editingSection !== section.id && (
                                <div className="flex items-center space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingSection(section.id, section.name)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteSection(section.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
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
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">Item Image (Optional)</Label>
                              {restaurant.isPremium && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Premium
                                </Badge>
                              )}
                            </div>
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
                              {editingItem === item.id ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input
                                      placeholder="Item name"
                                      value={editingItemData.name}
                                      onChange={(e) => setEditingItemData({ ...editingItemData, name: e.target.value })}
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Price"
                                      value={editingItemData.price}
                                      onChange={(e) => setEditingItemData({ ...editingItemData, price: Number.parseFloat(e.target.value) || 0 })}
                                    />
                                  </div>
                                  <Textarea
                                    placeholder="Description (optional)"
                                    value={editingItemData.description}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, description: e.target.value })}
                                  />
                                  <Input
                                    placeholder="Image URL (optional)"
                                    value={editingItemData.imageUrl}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, imageUrl: e.target.value })}
                                  />
                                  <div className="flex space-x-2">
                                    <Button size="sm" onClick={saveItemEdit}>
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelItemEdit}>
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-lg">{item.name}</h5>
                                    {item.description && (
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 ml-4">
                                    <span className="font-bold text-green-600 text-lg flex-shrink-0">
                                      ${item.price.toFixed(2)}
                                    </span>
                                    {restaurant.isPremium && (
                                      <div className="flex items-center space-x-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => startEditingItem(item)}
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => deleteItem(section.id, item.id)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
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

      {/* Menu Settings Modal */}
      <Dialog open={showMenuSettingsModal} onOpenChange={setShowMenuSettingsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <span className="text-green-600 text-xl mr-2">⚙️</span>
              Menu Display Settings
            </DialogTitle>
            <DialogDescription>
              Customize how your menu is displayed to customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Display Options */}
            <div className="space-y-4">
              <h3 className="font-semibold">Display Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="show-prices"
                    checked={menuSettings.showPrices}
                    onChange={(e) => setMenuSettings({ ...menuSettings, showPrices: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="show-prices" className="text-sm">Show Prices</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="show-descriptions"
                    checked={menuSettings.showDescriptions}
                    onChange={(e) => setMenuSettings({ ...menuSettings, showDescriptions: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="show-descriptions" className="text-sm">Show Descriptions</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="show-images"
                    checked={menuSettings.showImages}
                    onChange={(e) => setMenuSettings({ ...menuSettings, showImages: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="show-images" className="text-sm">Show Item Images</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="allow-sharing"
                    checked={menuSettings.allowSharing}
                    onChange={(e) => setMenuSettings({ ...menuSettings, allowSharing: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="allow-sharing" className="text-sm">Allow Sharing</Label>
                </div>
              </div>
            </div>

            {/* Custom Footer */}
            <div className="space-y-4">
              <Label htmlFor="custom-footer">Custom Footer Text</Label>
              <Textarea
                id="custom-footer"
                value={menuSettings.customFooter}
                onChange={(e) => setMenuSettings({ ...menuSettings, customFooter: e.target.value })}
                placeholder="Add a custom message at the bottom of your menu (optional)"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                This text will appear at the bottom of your public menu
              </p>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <Label>Preview</Label>
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Sample Menu Item</h4>
                      {menuSettings.showDescriptions && (
                        <p className="text-sm text-gray-600">Delicious description of the item</p>
                      )}
                    </div>
                    {menuSettings.showPrices && (
                      <span className="font-bold text-green-600">$12.99</span>
                    )}
                  </div>
                  {menuSettings.showImages && (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-500 text-xs">Image</span>
                    </div>
                  )}
                </div>
                {menuSettings.customFooter && (
                  <div className="mt-4 pt-4 border-t text-center text-sm text-gray-600">
                    {menuSettings.customFooter}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowMenuSettingsModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={updateMenuSettings}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? "Updating..." : "Update Settings"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customization Modal */}
      <Dialog open={showCustomizationModal} onOpenChange={setShowCustomizationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <span className="text-orange-600 text-xl mr-2">🎨</span>
              Customize Your Restaurant
            </DialogTitle>
            <DialogDescription>
              Update your restaurant details, logo, and theme color
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Restaurant Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Restaurant Name</Label>
                <Input
                  id="restaurant-name"
                  value={customizationData.name}
                  onChange={(e) => setCustomizationData({ ...customizationData, name: e.target.value })}
                  placeholder="Restaurant name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-location">Location</Label>
                <Input
                  id="restaurant-location"
                  value={customizationData.location}
                  onChange={(e) => setCustomizationData({ ...customizationData, location: e.target.value })}
                  placeholder="Address"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-4">
              <Label>Restaurant Logo</Label>
              <div className="flex items-center space-x-4">
                {logoPreview && (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={() => {
                        setNewLogo(null)
                        setLogoPreview("")
                        setCustomizationData({ ...customizationData, logoUrl: "" })
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload a square logo (recommended: 512x512px)
                  </p>
                </div>
              </div>
            </div>

            {/* Theme Color */}
            <div className="space-y-4">
              <Label>Theme Color</Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="color"
                  value={customizationData.themeColor}
                  onChange={(e) => setCustomizationData({ ...customizationData, themeColor: e.target.value })}
                  className="w-20 h-10"
                />
                <div className="flex-1">
                  <Input
                    value={customizationData.themeColor}
                    onChange={(e) => setCustomizationData({ ...customizationData, themeColor: e.target.value })}
                    placeholder="#3B82F6"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This color will be used throughout your menu
                  </p>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <Label>Preview</Label>
              <div 
                className="p-4 rounded-lg border-2 border-dashed"
                style={{ borderColor: customizationData.themeColor }}
              >
                <div className="flex items-center space-x-3">
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  )}
                  <div>
                    <h3 
                      className="font-semibold"
                      style={{ color: customizationData.themeColor }}
                    >
                      {customizationData.name || "Restaurant Name"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {customizationData.location || "Location"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCustomizationModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={updateRestaurantCustomization}
                disabled={isUpdating || !customizationData.name.trim()}
                className="flex-1"
              >
                {isUpdating ? "Updating..." : "Update Restaurant"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Modal */}
      <Dialog open={showPremiumModal} onOpenChange={setShowPremiumModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-500" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription>Unlock advanced features for your restaurant</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Premium Features */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Premium Features:</h3>
              <div className="grid gap-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Unlimited Menu Items</p>
                    <p className="text-xs text-gray-600">Add as many items as you want</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Advanced Analytics</p>
                    <p className="text-xs text-gray-600">Track customer engagement and menu performance</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Custom Branding</p>
                    <p className="text-xs text-gray-600">Remove QRMenu branding and add your own</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Priority Support</p>
                    <p className="text-xs text-gray-600">Get help when you need it most</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Printable Flyers</p>
                    <p className="text-xs text-gray-600">Generate professional QR code flyers</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg text-center">
              <div className="mb-2">
                <span className="text-3xl font-bold text-purple-600">$9.99</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">Start with a 7-day free trial</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• No setup fees</p>
                <p>• Cancel anytime</p>
                <p>• Secure payment processing</p>
              </div>
            </div>

            {/* CTA Button */}
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
              onClick={handleStartPremiumTrial}
              size="lg"
            >
              <Crown className="h-4 w-4 mr-2" />
              Start Premium Trial
            </Button>

            <p className="text-xs text-center text-gray-500">
              By starting the trial, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
