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
      if (viewer && ifcModel?.fileContent) {
        await viewer.IFC.dispose();

        let objectURL: string | null = null;
        try {
            const blob = new Blob([ifcModel.fileContent], { type: 'application/octet-stream' });
            objectURL = URL.createObjectURL(blob);
            
            const model = await viewer.IFC.loadIfc(objectURL, true);
            viewer.shadows.castShadows = true;
            if (model.geometry.boundingBox) {
                viewer.context.fitToBoundingBox(model.geometry.boundingBox, true);
            }
        } catch (error) {
            console.error("Fehler beim Laden des IFC-Modells:", error);
        } finally {
            if (objectURL) {
                URL.revokeObjectURL(objectURL);
            }
        }
      }
    };
    loadModel();
  }, [ifcModel]);


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
