'use client';

import { useEffect, useRef } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { IFCModel } from '@/lib/types';

interface ModelViewerProps {
  ifcModel: IFCModel;
}

export function ModelViewer({ ifcModel }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);

  useEffect(() => {
    if (viewerContainerRef.current && !viewerRef.current) {
      const container = viewerContainerRef.current;
      const viewer = new IfcViewerAPI({
        container,
        backgroundColor: '#E5E7EB', // bg-muted-light
      });

      viewer.axes.setAxes();
      viewer.grid.setGrid();
      
      // Path to the .wasm files from the public folder
      viewer.IFC.setWasmPath('/');

      viewerRef.current = viewer;
    }
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (viewer && ifcModel?.fileContent) {
        // Clear any previous model
        await viewer.IFC.dispose();

        const modelData = new Uint8Array(
            [...ifcModel.fileContent].map((char) => char.charCodeAt(0))
        );

        try {
            const model = await viewer.IFC.loadIfc(modelData, true);
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
  }, [ifcModel]);

  // Cleanup on unmount
  useEffect(() => {
    const viewer = viewerRef.current;
    return () => {
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, []);

  return (
    <Card className="h-full flex flex-col min-h-[400px] md:min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres BIM-Modells.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative">
        <div ref={viewerContainerRef} className="w-full h-full rounded-md" />
        {!ifcModel && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-2">Lade Modell...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
