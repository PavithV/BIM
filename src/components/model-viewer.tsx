'use client';

import { useEffect, useRef } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import {
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCDOOR,
  IFCFURNISHINGELEMENT,
  IFCWALL,
  IFCWINDOW,
} from 'web-ifc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ModelViewerProps {
  modelUrl: string | null;
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);

  // Function to safely clear models from the scene
  const clearScene = () => {
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.IFC.dispose();
    }
  };

  useEffect(() => {
    let viewer: IfcViewerAPI | null = null;
    const container = viewerContainerRef.current;

    const initializeViewer = async () => {
      if (!container) return;
      
      // Initialize the viewer
      viewer = new IfcViewerAPI({
        container,
        backgroundColor: '#E9E9EA',
      });
      
      await viewer.IFC.setWasmPath('/');

      // Store viewer instance in ref
      viewerRef.current = viewer;
    };
    
    initializeViewer();

    // Cleanup on component unmount
    return () => {
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (!viewer || !viewer.IFC.wasmModule) {
        // Wait until wasm is ready
        setTimeout(loadModel, 100);
        return;
      }
      
      // Clear previous models before loading a new one
      clearScene();

      if (modelUrl) {
        try {
          const model = await viewer.IFC.loadIfcUrl(modelUrl, true);

          // Optional: Add shadows and fit to bounding box
          viewer.shadows.castShadows = true;
          if (model.geometry.boundingBox) {
            viewer.context.fitToBoundingBox(model.geometry.boundingBox, true);
          }

        } catch (error) {
          console.error("Fehler beim Laden des IFC-Modells:", error);
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
