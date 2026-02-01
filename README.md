# 🏗️ BIMCoach Studio

BIMCoach Studio ist eine moderne Webanwendung zur Analyse und Optimierung von BIM-Modellen (Building Information Modeling). Die Plattform ermöglicht Architekten und Ingenieuren, IFC-Dateien hochzuladen, in 3D zu visualisieren und mithilfe von KI detaillierte Nachhaltigkeits- und Kostenanalysen durchzuführen.

![BIMCoach Studio Banner](https://placehold.co/1200x400/2563eb/ffffff?text=BIMCoach+Studio)

## 🚀 Features

- **3D-Visualisierung**: Interaktive Ansicht von IFC-Modellen direkt im Browser.
- **Nachhaltigkeitsanalyse**: KI-gestützte Bewertung der verbauten Materialien (KBOB/Ökobaudat).
- **Kostenschätzung**: Automatische Berechnung von Baukosten basierend auf Materialmengen.
- **KI-Assistent**: Chatten Sie mit Ihrem BIM-Modell, um spezifische Fragen zu klären.
- **Material-Review**: Überprüfen und bestätigen Sie KI-Vorschläge für Materialersetzungen.
- **Vergleichsansicht**: Vergleichen Sie verschiedene Versionen Ihrer Modelle.

## 🛠️ Tech Stack

Das Projekt basiert auf einem modernen und leistungsfähigen Tech-Stack:

### Frontend
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Shadcn UI](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)

### Backend & Services
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

### BIM & 3D
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)
![Web-IFC](https://img.shields.io/badge/Web--IFC-2c3e50?style=for-the-badge&logo=codestandard&logoColor=white)

## 📦 Installation & Setup

1. **Repository klonen**
   ```bash
   git clone https://github.com/PavithV/BIMCoach.git
   cd BIMCoach
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```
   *Hinweis: Der `postinstall` Skript kopiert automatisch die notwendigen WASM-Dateien für den IFC-Viewer.*

3. **Umgebungsvariablen konfigurieren**
   Erstellen Sie eine `.env` Datei im Hauptverzeichnis mit folgenden Schlüsseln:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_key
   # Weitere Keys je nach Bedarf
   ```

4. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```
   Die App ist nun unter `http://localhost:9002` erreichbar.

## 🌐 Deployment

Das Projekt ist für das Hosting auf **Firebase App Hosting** optimiert, kann aber auch auf Vercel oder anderen Node.js-kompatiblen Plattformen deployed werden.

## 🤝 Mitwirken

Beiträge sind willkommen! Bitte erstellen Sie einen Pull Request für Verbesserungsvorschläge.

---
*Entwickelt mit ❤️ für bessere Gebäude.*
