# 🌌 3D Radial Data Visualization Engine

A high-fidelity, interactive 3D visualization system built with **React** and **D3.js**. This project transforms complex hierarchical datasets into an immersive, multi-layered radial experience, optimized for both high-end desktops and mobile devices.

## 🚀 Key Features

*   **🎮 Immersive 3D Navigation**: Full 360-degree orbital rotation with smooth inertia-based movements. Support for scroll-to-zoom and mobile pinch gestures.
*   **📊 Multi-Dimensional D3.js Rendering**: Uses a layered SVG architecture to achieve genuine Z-depth, featuring glowing apex nodes, radial baseline labels, and animated connection chords.
*   **🧩 Intelligent Data Pipeline**: A robust sanitization engine that handles various JSON schemas. It automatically extracts categories, parses dates, and normalizes values with dataset-relative scaling.
*   **📱 Mobile-First Optimization**: Custom touch interaction logic that differentiates between chart manipulation and page scrolling, paired with responsive zoom framing for various screen aspect ratios.
*   **🔄 Persistent User State**: Built-in `localStorage` integration ensures that user-uploaded datasets persist across browser refreshes.
*   **⚡ Performance Balanced**: Implements GPU-accelerated CSS transforms and automated transition guards for large datasets (>80 items) to maintain a fluid 60FPS experience.

## 🛠️ Tech Stack

*   **Frontend**: React (Hooks, Functional Components)
*   **Visualization**: D3.js (Advanced joins, force-simulated curves, radial scales)
*   **Styling**: Tailwind CSS & Vanilla CSS (Neo-brutalist / Dark-mode aesthetic)
*   **Build Tool**: Vite (Ultra-fast HMR)
*   **Interactions**: Custom Pointer & Touch event management for 3D state

## 🚦 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 📂 Data Format
The engine accepts any JSON array. It is flexible and automatically detects common aliases:
```json
[
  {
    "date": "2025-01-01",
    "category": "Sales",
    "value": 450
  }
]
```
*Aliases supported:*
*   `category` → `genre` → `type`
*   `date` → `month`

## 🎨 Design Philosophy
The UI follows a modern **Glassmorphism** aesthetic, utilizing high-contrast HSL color palettes and SVG filters to create a premium "dashboard" feel. Every interaction is designed to be tactile—from the pulsing central core to the "Snap-to-2D" image reset.

---
*Created as part of a high-fidelity data visualization*
