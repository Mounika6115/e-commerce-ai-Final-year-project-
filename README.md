
# AI-Powered Social E-Commerce Platform

This project is an academic prototype demonstrating how AI-driven recommendation engines and social interaction features can modernize the shopping experience.

## Core Features

### 1. AI Recommendation Engine
- **Logic:** Rule-based filtering followed by a weighted scoring system.
- **Explainability:** Each recommendation includes a score and a specific reason (e.g., "Perfect for Wedding," "Trending Now," or "Within Budget").
- **Weights:** 
  - Occasion Matching (50%)
  - Budget Proximity (30%)
  - Popularity Score (20%)

### 2. Social Shopping
- **In-App Chat:** Real-time (simulated) chat between users.
- **Product Sharing:** Users can share product cards directly into the chat for feedback.

### 3. Modern E-Commerce UI
- Responsive design using Tailwind CSS.
- Smooth transitions and interactive elements.
- Mock authentication and cart state.

## Architecture

- **Frontend:** React with TypeScript.
- **State Management:** React Hooks (`useState`, `useCallback`).
- **AI Logic:** Encapsulated in `aiEngine.ts` (simulating a Flask-based inference engine).
- **Data Source:** Static JSON-like mock objects (simulating `products.json` and `users.json`).

## Academic Note
This project focuses on the **Explainable AI** aspect of recommendations. In a production environment, the `aiEngine.ts` logic would reside in a Flask microservice, processing requests from the React frontend via REST APIs or WebSockets.
