import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const restaurantId = session.metadata?.restaurantId

    if (restaurantId) {
      try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
          isPremium: true,
          trialStartDate: new Date(),
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error("Error updating restaurant premium status:", error)
      }
    }
  }

  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription
    const restaurantId = subscription.metadata?.restaurantId

    if (restaurantId) {
      // You could send an email notification here about trial ending
      console.log(`Trial ending for restaurant: ${restaurantId}`)
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    const restaurantId = subscription.metadata?.restaurantId

    if (restaurantId) {
      try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
          isPremium: false,
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error("Error updating restaurant premium status:", error)
      }
    }
  }

  return NextResponse.json({ received: true })
}
