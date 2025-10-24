'use client';

import { useEffect, useRef } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ModelViewerProps {
  modelUrl: string | null;
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);

  useEffect(() => {
    if (viewerContainerRef.current && !viewerRef.current) {
      const container = viewerContainerRef.current;
      const viewer = new IfcViewerAPI({
        container,
        backgroundColor: '#E9E9EA', // Corresponds to light gray --background
      });

      viewer.axes.setAxes();
      viewer.grid.setGrid();
      
      viewer.IFC.setWasmPath('/');

      viewerRef.current = viewer;
    }

    // Cleanup on component unmount
    return () => {
        viewerRef.current?.dispose();
        viewerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (viewer) {
        await viewer.IFC.dispose(); // Clear previous model
        if (modelUrl) {
          try {
            const model = await viewer.IFC.loadIfcUrl(modelUrl, true);
            viewer.shadows.castShadows = true;
            if (model.geometry.boundingBox) {
                viewer.context.fitToBoundingBox(model.geometry.boundingBox, true);
            }
          } catch (error) {
              console.error("Fehler beim Laden des IFC-Modells:", error);
          }
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
