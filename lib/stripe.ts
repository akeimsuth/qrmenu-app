import { loadStripe } from "@stripe/stripe-js"

export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export const createCheckoutSession = async (restaurantId: string) => {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      restaurantId,
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to create checkout session")
  }

  const { sessionId } = await response.json()
  
  // Return the session URL for direct redirect
  return `/api/redirect-to-checkout?sessionId=${sessionId}`
}
