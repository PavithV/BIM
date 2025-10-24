'use client';

import { useEffect, useRef } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Color } from 'three';

interface ModelViewerProps {
  modelUrl: string | null;
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);

  const clearScene = () => {
    const viewer = viewerRef.current;
    if (viewer) {
      try {
        viewer.IFC.loader.ifcManager.dispose();
      } catch (err) {
        console.warn("⚠️ Fehler beim Leeren der Szene:", err);
      }
    }
  };

  useEffect(() => {
    let viewer: IfcViewerAPI | null = null;
    const container = viewerContainerRef.current;
    if (!container) return;

    const initializeViewer = async () => {
      // 1️⃣ Viewer initialisieren
      viewer = new IfcViewerAPI({
        container,
        backgroundColor: new Color(0xf3f4f6),
      });

      // 2️⃣ WASM Pfad korrekt setzen
      await viewer.IFC.setWasmPath('/wasm/');

      // 3️⃣ Kurze Verzögerung, bis Unterkomponenten (grid, axes) fertig geladen sind
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 4️⃣ Jetzt sicher grid und axes aktivieren
      if (viewer.grid && viewer.axes) {
        viewer.grid.setGrid();
        viewer.axes.setAxes();
      } else {
        console.warn("⚠️ grid oder axes sind noch nicht bereit");
      }

      // 5️⃣ Speichern
      viewerRef.current = viewer;
    };

    initializeViewer();

    // Cleanup bei Komponentenausbau
    return () => {
      viewer?.dispose?.();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      // Warten, bis IFC Modul bereit ist
      if (!viewer.IFC.wasmModule) {
        setTimeout(loadModel, 100);
        return;
      }

      clearScene();

      if (modelUrl) {
        try {
          const model = await viewer.IFC.loadIfcUrl(modelUrl, true);

          viewer.shadows.castShadows = true;
          if(viewer.context.renderer.postProduction) {
            viewer.context.renderer.postProduction.active = true;
          }

          if (model.geometry?.boundingBox) {
            viewer.context.fitToBoundingBox(model.geometry.boundingBox, true);
          } else {
            viewer.context.fitToFrame();
          }

        } catch (error) {
          console.error("❌ Fehler beim Laden des IFC-Modells:", error);
        }
      }
    };

    loadModel();
  }, [modelUrl]);

  return (
    <Card className="h-full flex flex-col min-h-[400px] md:min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres BIM-Modells.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative">
        <div ref={viewerContainerRef} className="w-full h-full rounded-md" />
        {!modelUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-2 mt-2 text-muted-foreground">Lade Modell nach Analyse...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
