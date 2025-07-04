"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Clock } from "lucide-react"
import { collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Restaurant, Menu } from "@/lib/types"

export default function PublicMenuPage() {
  const params = useParams()
  const slug = params.slug as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMenuData()
  }, [slug])

  function formatFirestoreDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
      console.warn("Invalid Firestore Timestamp:", timestamp);
      return "";
    }
  
    return timestamp.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const loadMenuData = async () => {
    try {
      // Find restaurant by slug
      const restaurantQuery = query(collection(db, "restaurants"), where("slug", "==", slug))
      const restaurantSnapshot = await getDocs(restaurantQuery)

      if (restaurantSnapshot.empty) {
        setLoading(false)
        return
      }

      const restaurantDoc = restaurantSnapshot.docs[0]
      const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant
      setRestaurant(restaurantData)

      // Increment view count
      await updateDoc(doc(db, "restaurants", restaurantDoc.id), {
        menuViews: increment(1),
      })

      // Load menu
      const menuQuery = query(collection(db, "menus"), where("restaurantId", "==", restaurantDoc.id))
      const menuSnapshot = await getDocs(menuQuery)

      if (!menuSnapshot.empty) {
        const menuData = { id: menuSnapshot.docs[0].id, ...menuSnapshot.docs[0].data() } as Menu
        setMenu(menuData)
      }
    } catch (error) {
      console.error("Error loading menu:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading menu...</p>
        </div>
      </div>
    )
  }

  if (!restaurant || !menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Menu not found</h1>
          <p className="text-gray-600">This restaurant menu is not available.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${restaurant.themeColor}10` }}>
      {/* Header */}
      <header className="text-white py-8" style={{ backgroundColor: restaurant.themeColor }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl || "/placeholder.svg"}
                alt={restaurant.name}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-white p-2"
              />
            )}
            <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
            <div className="flex items-center justify-center space-x-4 text-sm opacity-90">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {restaurant.location}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Updated {formatFirestoreDate(menu.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {menu.sections.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Menu Coming Soon</h2>
              <p className="text-gray-600">We're working on updating our menu. Please check back soon!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {menu.sections.map((section, sectionIndex) => (
              <Card key={section.id} className="overflow-hidden">
                <CardHeader className="text-white" style={{ backgroundColor: restaurant.themeColor }}>
                  <CardTitle className="text-xl">{section.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {section.items.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No items in this section yet</div>
                  ) : (
                    <div className="divide-y">
                      {section.items.map((item, itemIndex) => (
                        <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-4">
                            {/* Item Image */}
                            {item.imageUrl && (
                              <div className="flex-shrink-0">
                                <img
                                  src={item.imageUrl || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border shadow-sm"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              </div>
                            )}

                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                                  {item.description && (
                                    <p className="text-gray-600 text-sm mb-2 leading-relaxed">{item.description}</p>
                                  )}
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  <span
                                    className="text-xl font-bold px-3 py-1 rounded-full text-white"
                                    style={{ backgroundColor: restaurant.themeColor }}
                                  >
                                    ${item.price.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t">
          <p className="text-gray-600 text-sm">
            Powered by <span className="font-semibold">QRMenu</span>
          </p>
        </div>
      </main>
    </div>
  )
}
