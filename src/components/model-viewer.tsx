
'use client';

import { useEffect, useRef, useState } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Color, Group, Box3, Vector3, Mesh, MeshLambertMaterial } from 'three';

interface ModelViewerProps {
  modelUrl: string | null;
}

function base64ToUint8Array(base64: string) {
    const base64Marker = 'base64,';
    const base64Index = base64.indexOf(base64Marker) + base64Marker.length;
    const pureBase64 = base64.substring(base64Index);
    const binaryString = window.atob(pureBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let viewer: IfcViewerAPI | null = null;
    const container = viewerContainerRef.current;
    if (!container) return;

    const initializeViewer = async () => {
      try {
        viewer = new IfcViewerAPI({
          container,
          backgroundColor: new Color(0xf3f4f6),
        });
        await viewer.IFC.setWasmPath('/wasm/');
        await viewer.IFC.ifcManager.applyWebIfcConfig({
            COORDINATE_TO_ORIGIN: true,
            USE_FAST_BOOLS: false
        });
        viewerRef.current = viewer;
      } catch (err) {
        console.error("Fehler bei der Initialisierung des Viewers:", err);
        setError("Der 3D-Viewer konnte nicht initialisiert werden.");
      }
    };

    initializeViewer();

    return () => {
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (!viewer || !modelUrl) {
          setIsLoading(!modelUrl);
          return;
      }
      
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(modelUrl);
        const ifcBytes = await response.arrayBuffer();
        const model = await viewer.IFC.loadIfc(new Uint8Array(ifcBytes));

        if (model.mesh.geometry.attributes.position.count === 0) {
            setError("Das Modell wurde geladen, enthält aber keine sichtbaren geometrischen Elemente.");
        } else {
            viewer.shadows.castShadows = true;
            viewer.context.renderer.postProduction.active = true;
        }

      } catch (err) {
        console.error("Fehler beim Laden des IFC-Modells:", err);
        setError("Das IFC-Modell konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
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
        {(isLoading || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md">
            {isLoading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="ml-2 mt-2 text-muted-foreground">Lade Modell...</p>
              </>
            ) : error ? (
              <div className="text-center p-4">
                  <AlertTriangle className="w-8 h-8 mx-auto text-destructive mb-2" />
                  <p className="font-semibold">Ein Fehler ist aufgetreten</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
