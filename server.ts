import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get simulated market data
const getMarketData = () => [
  { symbol: "AAPL", name: "Apple Inc.", price: 150 + Math.random() * 10 },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 2800 + Math.random() * 50 },
  { symbol: "TSLA", name: "Tesla, Inc.", price: 700 + Math.random() * 20 },
  { symbol: "AMZN", name: "Amazon.com, Inc.", price: 3300 + Math.random() * 40 },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 300 + Math.random() * 5 },
  { symbol: "BTC", name: "Bitcoin", price: 45000 + Math.random() * 1000 },
  { symbol: "ETH", name: "Ethereum", price: 3000 + Math.random() * 100 },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  // Initialize Firebase Admin for alert checking
  let db: any = null;
  let dbId: string | undefined = undefined;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      
      // Initialize Admin SDK
      if (admin.apps.length === 0) {
        try {
          admin.initializeApp({
            projectId: firebaseConfig.projectId,
          });
          console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
        } catch (initError) {
          console.error("Firebase Admin initialization failed:", initError);
          admin.initializeApp();
        }
      }
      
      dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
        ? firebaseConfig.firestoreDatabaseId 
        : undefined;
      
      // Initialize Firestore instance
      try {
        // In firebase-admin v13, we can use getFirestore from firebase-admin/firestore to specify a databaseId
        const { getFirestore } = await import("firebase-admin/firestore");
        db = getFirestore(admin.app(), dbId);
        console.log(`Targeting Firestore database: ${dbId || '(default)'}`);
      } catch (dbError) {
        console.warn(`Failed to access database ${dbId || '(default)'}, trying default...`);
        db = admin.firestore();
      }
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin in server:", error);
  }

    // Alert checking background task
    if (db) {
      setInterval(async () => {
        try {
          const marketData = getMarketData();
          const alertsRef = db.collection("alerts");
          let snapshot;
          
          try {
            snapshot = await alertsRef.where("status", "==", "active").get();
          } catch (queryError: any) {
            // If we get a NOT_FOUND error (code 5), the database ID might be wrong
            if (queryError.code === 5 || queryError.message?.includes("NOT_FOUND")) {
              console.warn(`Database ${dbId || '(default)'} not found. Falling back to default database...`);
              db = admin.firestore(); // Switch to default for future calls
              snapshot = await db.collection("alerts").where("status", "==", "active").get();
            } else {
              throw queryError;
            }
          }
        
        if (snapshot.empty) return;

        const batch = db.batch();
        let hasUpdates = false;

        for (const alertDoc of snapshot.docs) {
          const alert = alertDoc.data();
          const stock = marketData.find((s: any) => s.symbol === alert.symbol);
          
          if (stock) {
            let triggered = false;
            if (alert.direction === "above" && stock.price >= alert.threshold) {
              triggered = true;
            } else if (alert.direction === "below" && stock.price <= alert.threshold) {
              triggered = true;
            }

            if (triggered) {
              console.log(`Alert triggered for ${alert.symbol}: ${stock.price} is ${alert.direction} ${alert.threshold}`);
              batch.update(alertDoc.ref, {
                status: "triggered",
                triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                triggerPrice: stock.price
              });
              hasUpdates = true;
            }
          }
        }

        if (hasUpdates) {
          await batch.commit();
        }
      } catch (error) {
        console.error("Error checking alerts:", error);
      }
    }, 30000); // Check every 30 seconds
  }

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Simulated Market Data API
  app.get("/api/market", (req, res) => {
    res.json(getMarketData());
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
