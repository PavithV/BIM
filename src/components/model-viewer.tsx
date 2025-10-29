
'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layers, Loader2, AlertTriangle } from 'lucide-react';

interface ModelViewerProps {
  ifcContent: string | null;
}

// Helper to convert Base64 Data URL to a Uint8Array
function dataURLtoUint8Array(dataurl: string) {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid Base64 Data URL");
    
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return u8arr;
}

export function ModelViewer({ ifcContent }: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<any>(null); // Use 'any' as xeokit types are not imported
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);

  useEffect(() => {
    // Dynamically load the xeokit SDK from a CDN
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xeokit-sdk@2.9.2/dist/xeokit-sdk.es.min.js";
    script.type = 'module';
    script.onload = () => {
        // The SDK is loaded as an ES module, so Viewer and XKTLoaderPlugin are on the window.xeokit object
        if ((window as any).xeokit) {
            setIsSdkLoaded(true);
        } else {
            setError("Fehler beim Laden des 3D-Viewer-SDKs.");
        }
    };
    script.onerror = () => {
        setError("Fehler beim Laden des 3D-Viewer-SDKs von CDN.");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isSdkLoaded || !canvasRef.current) return;

    // Initialize viewer once SDK is loaded
    const { Viewer } = (window as any).xeokit;
    const viewer = new Viewer({
      canvasId: canvasRef.current.id,
      transparent: true,
    });
    
    viewerRef.current = viewer;
    
    const cameraControl = viewer.cameraControl;
    cameraControl.navMode = "orbit";

    return () => {
      if (viewer) {
        viewer.destroy();
      }
    };
  }, [isSdkLoaded]);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (!viewer || !ifcContent) {
        if (viewer) viewer.scene.clear();
        setIsLoading(false);
        setError(null);
        return;
      }
      
      viewer.scene.clear();
      setIsLoading(true);
      setError(null);
      
      try {
        const { XKTLoaderPlugin } = (window as any).xeokit;
        const ifcData = dataURLtoUint8Array(ifcContent);
        
        const xktLoader = new XKTLoaderPlugin(viewer);
        
        const model = xktLoader.load({
            id: `model-${Date.now()}`,
            xkt: ifcData,
        });

        viewer.camera.orbitPitch(20);
        
        model.on("loaded", () => {
            viewer.cameraFlight.flyTo({
                aabb: viewer.scene.getAABB(),
                duration: 1.0,
            });
            setIsLoading(false);
        });
        model.on("error", (e: any) => {
             throw new Error(`Fehler beim Parsen des Modells: ${e}`);
        });

      } catch (err) {
        console.error("Fehler beim Laden des IFC-Modells:", err);
        setError("Das Modell konnte nicht geladen werden. Es ist möglicherweise keine gültige XKT-Datei. IFC-Dateien müssen vorverarbeitet werden.");
        setIsLoading(false);
      }
    };

    if (isSdkLoaded) {
      loadModel();
    }
  }, [ifcContent, isSdkLoaded]);


  const renderOverlay = () => {
    if (isLoading || !isSdkLoaded) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="font-semibold">{!isSdkLoaded ? "Lade Viewer-Komponenten..." : "Lade 3D-Modell..."}</p>
        </div>
      );
    }
    if (error) {
       return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
          <p className="font-semibold text-destructive">Fehler beim Laden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }
    if (!ifcContent && !isLoading) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="font-semibold">Kein Modell ausgewählt</p>
          <p className="text-sm text-muted-foreground">Wählen Sie ein Projekt aus, um die 3D-Ansicht zu laden.</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col min-h-[400px] md:min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres BIM-Modells.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative group">
        <canvas id="model-canvas" ref={canvasRef} className="w-full h-full rounded-md bg-muted/30"></canvas>
        {renderOverlay()}
      </CardContent>
    </Card>
  );
}
