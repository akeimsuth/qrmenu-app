export interface Restaurant {
  id: string
  name: string
  email: string
  location: string
  logoUrl?: string
  slug: string
  themeColor: string
  isPremium: boolean
  createdAt: Date
  updatedAt: Date
  menuViews: number
}

export interface MenuSection {
  id: string
  name: string
  items: MenuItem[]
}

export interface MenuItem {
  id: string
  name: string
  price: number
  description?: string
  imageUrl?: string
  imageType?: "upload" | "url"
}

export interface Menu {
  id: string
  restaurantId: string
  sections: MenuSection[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
