'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, Layers } from 'lucide-react';

interface IfcViewerProps {
  ifcContent: string | null;
}

async function stringToIfcFile(content: string, fileName: string) {
  if (content.startsWith('data:')) {
    const blob = await fetch(content).then(r => r.blob());
    return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  }
  const blob = new Blob([content], { type: 'text/plain' });
  return new File([blob], fileName, { type: 'text/plain' });
}

export function IfcViewer({ ifcContent }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current) return;
      if (initializedRef.current) return;
      try {
        const wasmPath = `/wasm/`;
        // Setze bekannte globale Flags, die von verschiedenen Versionen gelesen werden
        try { (window as any).WEBIFC_PATH = wasmPath; } catch {}
        try { (window as any).webIfcWasmPath = wasmPath; } catch {}
        try { (window as any).ifcjsWasmPath = wasmPath; } catch {}

        const mod = await import('web-ifc-viewer');
        const { IfcViewerAPI } = mod as any;
        // Vorheriges Viewer-Objekt konsequent entsorgen
        try { viewerRef.current?.dispose?.(); } catch {}
        viewerRef.current = null;
        // Container leeren, um Mehrfach-Canvas zu vermeiden
        try {
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
        } catch {}
        // Stabile Container-Styles
        try {
          containerRef.current.style.position = 'relative';
          containerRef.current.style.width = '100%';
          if (containerRef.current.clientHeight === 0) {
            containerRef.current.style.minHeight = '400px';
          }
        } catch {}
        const viewer = new IfcViewerAPI({
          container: containerRef.current,
          backgroundColor: new (await import('three')).Color(0xf3f4f6),
        });
        // Stelle sicher, dass Pfad auch im Manager gesetzt ist
        try { viewer.IFC.setWasmPath(wasmPath); } catch {}
        try { viewer?.IFC?.loader?.ifcManager?.setWasmPath(wasmPath); } catch {}
        // Nur einmal Raster/Achsen setzen; doppelte Helfer vermeiden
        try { viewer.grid?.reset?.(); } catch {}
        try { viewer.axes?.reset?.(); } catch {}
        try { viewer.grid?.setGrid(); } catch {}
        try { viewer.axes?.setAxes(); } catch {}
        // Renderer sicher aktivieren
        try { (viewer.context.renderer as any).postProduction.active = true; } catch {}
        // Mindesthöhe erzwingen, falls Layout keine Höhe bereitstellt
        try { if (containerRef.current && containerRef.current.clientHeight === 0) { containerRef.current.style.minHeight = '400px'; } } catch {}
        // Auf Containergröße anpassen
        try { viewer.context.resize(); } catch {}
        try {
          const onResize = () => { try { viewer.context.resize(); } catch {} };
          window.addEventListener('resize', onResize);
          (viewer as any).__onResize = onResize;
        } catch {}
        if (!disposed) {
          viewerRef.current = viewer;
          initializedRef.current = true;
        }
      } catch (e) {
        if (!disposed) setError('Fehler beim Initialisieren des IFC Viewers.');
        console.error(e);
      }
    })();
    return () => {
      disposed = true;
      if (viewerRef.current) {
        try {
          viewerRef.current.dispose();
        } catch {}
        viewerRef.current = null;
      }
      initializedRef.current = false;
      try {
        const handler = (viewerRef.current as any)?.__onResize;
        if (handler) window.removeEventListener('resize', handler);
      } catch {}
    };
  }, []);

  useEffect(() => {
    (async () => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      if (!ifcContent) {
        // Nichts geladen: Szene räumen
        try {
          viewer.context.items.pickableIfcModels = [];
          viewer.context.getScene().removeFromScene();
        } catch {}
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // IFC-Datei aus Data-URL oder Plain-Text erzeugen
        const file = await stringToIfcFile(ifcContent, `model_${Date.now()}.ifc`);
        // Vorherige Modelle (best effort) entfernen
        try { await viewer.IFC.unloadAll(); } catch {}
        // Primär: Datei direkt laden
        let model: any;
        try {
          model = await viewer.IFC.loadIfc(file, true);
        } catch (err) {
          // Fallback: über ObjectURL laden (einige Versionen erwarten URL-String)
          const objectUrl = URL.createObjectURL(file);
          try {
            model = await viewer.IFC.loadIfcUrl(objectUrl, true);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
        if (model && model.modelID != null) {
          try { await viewer.shadowDropper.renderShadow(model.modelID); } catch {}
        }
        try { await viewer.context.renderer.postProduction.update(); } catch {}
        try { viewer.context.fitToFrame(); } catch {}
        try { viewer.context.resize(); } catch {}
        setIsLoading(false);
      } catch (e) {
        console.error('Fehler beim Laden des IFC-Modells:', e);
        setError('Das IFC-Modell konnte nicht geladen werden.');
        setIsLoading(false);
      }
    })();
  }, [ifcContent]);

  const renderOverlay = () => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="font-semibold">Lade IFC-Modell...</p>
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
        <CardDescription>Interaktive Ansicht Ihres IFC-Modells (IFC.js).</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full rounded-md bg-muted/30" />
        {renderOverlay()}
      </CardContent>
    </Card>
  );
}

export default IfcViewer;


