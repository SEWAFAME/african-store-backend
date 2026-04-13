require("dotenv").config();

const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const serviceAccount = require("./firebase-service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/create-stripe-checkout", async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      phone,
      items,
      subtotal,
      deliveryFee,
      total
    } = req.body;

    console.log("POST /create-stripe-checkout hit");
    console.log(req.body);

    if (!orderId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({
        error: "Missing required order data"
      });
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "cad",
        product_data: {
          name: item.name || "Item"
        },
        unit_amount: Math.round(Number(item.price || 0) * 100)
      },
      quantity: Number(item.quantity || 1)
    }));

    if (Number(deliveryFee || 0) > 0) {
      lineItems.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: "Delivery Fee"
          },
          unit_amount: Math.round(Number(deliveryFee || 0) * 100)
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `https://african-store-app.web.app/online-store/success.html?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://african-store-app.web.app/online-store/failure.html`,

      metadata: {
        orderId: orderId || "",
        customerName: customerName || "",
        phone: phone || "",
        subtotal: String(subtotal || 0),
        deliveryFee: String(deliveryFee || 0),
        total: String(total || 0)
      }
    });

    res.json({
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({
      error: error.message || "Could not create checkout session"
    });
  }
});

app.post("/confirm-payment", async (req, res) => {
  try {
    const { sessionId, orderId } = req.body;

    console.log("🔥 Confirm payment called");
    console.log("Session ID:", sessionId);
    console.log("Order ID:", orderId);

    if (!sessionId || !orderId) {
      return res.status(400).json({
        error: "Missing sessionId or orderId"
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        error: "Payment not completed"
      });
    }

    await db.collection("orders").doc(orderId).update({
  paymentStatus: "paid",
  orderStatus: "confirmed",
  status: "confirmed",
  stripeSessionId: sessionId,
  confirmedAt: new Date().toISOString(),
  paidAt: new Date().toISOString()
});


    console.log("✅ Order updated to PAID:", orderId);

    res.json({
      success: true,
      message: "Payment verified and Firestore updated successfully."
    });
  } catch (error) {
    console.error("❌ Confirm payment error:", error);
    res.status(500).json({
      error: error.message || "Could not confirm payment"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

