'use client';

import { useEffect, useRef, useState } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Color } from 'three';

interface ModelViewerProps {
  ifcContent: string | null;
}

export function ModelViewer({ ifcContent }: ModelViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationStatus, setInitializationStatus] = useState('Initialisiere Viewer...');

  useEffect(() => {
    let viewer: IfcViewerAPI | null = null;
    const container = viewerContainerRef.current;
    if (!container) return;

    const initializeViewer = async () => {
      try {
        setInitializationStatus('Erstelle Viewer...');
        
        viewer = new IfcViewerAPI({
          container,
          backgroundColor: new Color(0xf3f4f6),
        });

        if (!viewer.IFC) {
          throw new Error('IFC-Modul konnte nicht im Viewer gefunden werden.');
        }

        setInitializationStatus('Lade WebAssembly-Modul...');
        // Directly set wasmPath to a reliable CDN
        await viewer.IFC.setWasmPath('https://cdn.jsdelivr.net/npm/web-ifc@0.0.50/');
        
        viewerRef.current = viewer;
        
      } catch (err) {
        console.error('Fehler bei der Initialisierung des Viewers:', err);
        setError(`3D-Viewer konnte nicht initialisiert werden: ${(err as Error).message}`);
        setIsLoading(false);
      }
    };

    initializeViewer();

    return () => {
      if (viewer) {
        try {
          viewer.dispose();
        } catch (e) {
          console.warn('Fehler beim Aufräumen des Viewers:', e);
        }
      }
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const viewer = viewerRef.current;
      if (!viewer || !ifcContent) {
        if (!ifcContent) setIsLoading(false);
        return;
      }

      if (!viewer.IFC) {
        setError('IFC-Modul ist nicht verfügbar. Das Modell kann nicht geladen werden.');
        setIsLoading(false);
        return;
      }
      
      setError(null);
      setIsLoading(true);
      setInitializationStatus('Lade IFC-Modell...');

      try {
        const response = await fetch(ifcContent);
        const ifcBytes = await response.arrayBuffer();

        const model = await viewer.IFC.loadIfc(new Uint8Array(ifcBytes));

        if (model.mesh.geometry.attributes.position.count === 0) {
          setError("Das Modell wurde geladen, enthält aber keine sichtbaren geometrischen Elemente.");
        } else {
          viewer.shadows.castShadows = true;
          viewer.context.renderer.postProduction.active = true;
        }
        
      } catch (err) {
        console.error('Fehler beim Laden des IFC-Modells:', err);
        setError(`Das IFC-Modell konnte nicht geladen werden: ${(err as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only try to load if the viewer is initialized
    if (viewerRef.current) {
        loadModel();
    }

  }, [ifcContent]);

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
                <p className="ml-2 mt-2 text-muted-foreground text-center">
                  {initializationStatus}
                </p>
              </>
            ) : error ? (
              <div className="text-center p-4">
                <AlertTriangle className="w-8 h-8 mx-auto text-destructive mb-2" />
                <p className="font-semibold">Ein Fehler ist aufgetreten</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <button 
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                  onClick={() => window.location.reload()}
                >
                  Seite neu laden
                </button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
