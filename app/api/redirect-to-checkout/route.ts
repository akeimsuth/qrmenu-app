import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    if (session.url) {
      return NextResponse.redirect(session.url)
    } else {
      return NextResponse.json({ error: "Checkout session URL not found" }, { status: 404 })
    }
  } catch (error) {
    console.error("Error retrieving checkout session:", error)
    return NextResponse.json({ error: "Failed to retrieve checkout session" }, { status: 500 })
  }
} 