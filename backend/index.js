import express from "express";
import dotenv from "dotenv";
import { connectToMongoDB } from "./src/db/mong.js";
import cors from "cors";
import partyRoutes from "./src/routes/party.routes.js";
dotenv.config();

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
    // methods: ["GET", "POST", "PUT", "DELETE"],
    // allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.json({
    message: "Party Planner API",
  });
});

app.use(
  "/api/party",
  partyRoutes
);



Promise.all([connectToMongoDB()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error starting the server:", error);
    process.exit(1);
  });
