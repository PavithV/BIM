'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, Layers } from 'lucide-react';
import { getBlob, ref as storageRef } from 'firebase/storage';
import { useStorage } from '@/firebase';

interface IfcViewerProps {
  ifcContent: string | null | undefined;
  ifcUrl?: string | null;
  ifcStoragePath?: string | null;
}

async function stringToIfcFile(content: string, fileName: string) {
  if (content.startsWith('data:')) {
    const blob = await fetch(content).then(r => r.blob());
    return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  }
  const blob = new Blob([content], { type: 'text/plain' });
  return new File([blob], fileName, { type: 'text/plain' });
}

export function IfcViewer({ ifcContent, ifcUrl, ifcStoragePath }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const loadedModelIdsRef = useRef<number[]>([]);
  const storage = useStorage();

  const createViewer = async () => {
    if (!containerRef.current) throw new Error('Container fehlt');

    // Dispose vorhandener Viewer
    if (viewerRef.current) {
      try { viewerRef.current.dispose?.(); } catch {}
      viewerRef.current = null;
    }

    // Stabile Container-Styles
    containerRef.current.style.position = 'relative';
    containerRef.current.style.width = '100%';
    containerRef.current.style.minHeight = containerRef.current.clientHeight > 0 ? `${containerRef.current.clientHeight}px` : '400px';
    containerRef.current.style.overflow = 'hidden';

    const wasmPath = `/wasm/`;
    try { (window as any).WEBIFC_PATH = wasmPath; } catch {}
    try { (window as any).webIfcWasmPath = wasmPath; } catch {}
    try { (window as any).ifcjsWasmPath = wasmPath; } catch {}

    // IfcViewerAPI lokal / CDN fallback
    let IfcViewerAPI: any;
    try {
      const mod = await import('web-ifc-viewer');
      IfcViewerAPI = (mod as any).IfcViewerAPI || (mod as any).default?.IfcViewerAPI || (mod as any).default || mod;
    } catch (err) {
      const cdnUrl = 'https://esm.sh/web-ifc-viewer@1.0.218';
      const modCdn: any = await import(/* webpackIgnore: true */ cdnUrl);
      IfcViewerAPI = modCdn?.IfcViewerAPI || modCdn?.default || modCdn;
      if (!IfcViewerAPI) throw new Error('web-ifc-viewer konnte weder lokal noch vom CDN geladen werden.');
    }

    // Viewer erzeugen
    const three = await import('three');
    const viewer = new IfcViewerAPI({
      container: containerRef.current,
      backgroundColor: new (three as any).Color(0xf3f4f6),
    });

    // Renderer DOM so setzen, dass es kein Layout sprengt
    try {
      const dom = (viewer.context?.renderer as any)?.domElement ?? viewer.context?.renderer?.domElement;
      if (dom) {
        dom.style.display = 'block';
        dom.style.width = '100%';
        dom.style.height = '100%';
        dom.style.position = 'absolute';
        dom.style.inset = '0';
      }
    } catch {}

    // Setze Wasm-Pfade in möglichen APIs (best-effort)
    try { viewer.IFC.setWasmPath(wasmPath); } catch {}
    try { viewer?.IFC?.loader?.ifcManager?.setWasmPath(wasmPath); } catch {}

    // Grid/Axes initialisieren
    try { viewer.grid?.setGrid?.(); } catch {}
    try { viewer.axes?.setAxes?.(); } catch {}
    // PostProduction falls vorhanden aktivieren
    try { (viewer.context.renderer as any).postProduction.active = true; } catch {}

    // ResizeObserver
    if (resizeObserverRef.current) {
      try { resizeObserverRef.current.disconnect(); } catch {}
      resizeObserverRef.current = null;
    }
    const ro = new ResizeObserver(() => {
      try { viewer.context.resize(); } catch {}
    });
    ro.observe(containerRef.current);
    resizeObserverRef.current = ro;

    viewerRef.current = viewer;
    return viewer;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await createViewer();
      } catch (e) {
        console.error(e);
        if (mounted) setError('Fehler beim Initialisieren des IFC-Viewers.');
      }
    })();
    return () => {
      mounted = false;
      try { resizeObserverRef.current?.disconnect(); } catch {}
      try { viewerRef.current?.dispose?.(); } catch {}
      viewerRef.current = null;
      resizeObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      console.log('IfcViewer useEffect triggered:', { hasContent: !!ifcContent, hasUrl: !!ifcUrl, hasStoragePath: !!ifcStoragePath, url: ifcUrl, storagePath: ifcStoragePath });
      
      if (!viewerRef.current) {
        try { await createViewer(); } catch (e) { console.error(e); setError('Viewer nicht verfügbar'); return; }
      }
      const viewer = viewerRef.current;
      if (!viewer || !containerRef.current) return;

      if (!ifcContent && !ifcUrl && !ifcStoragePath) {
        setIsLoading(false);
        setError(null);
        setHasModel(false);
        try { await viewer.IFC.unloadAll?.(); } catch {}
        loadedModelIdsRef.current = [];
        try { viewer.context.items.pickableIfcModels = []; } catch {}
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasModel(false);

      try {
        // Sauberer Start: Viewer disposen und neu erstellen
        try { viewerRef.current?.dispose?.(); } catch {}
        viewerRef.current = null;
        loadedModelIdsRef.current = [];

        try {
          while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild);
        } catch {}

        const newViewer = await createViewer();

        // Lade Datei: entweder aus ifcContent, Storage-Pfad oder Storage-URL
        let file: File;
        let storagePathToUse: string | null = null;
        
        // Bestimme den Storage-Pfad: zuerst aus ifcStoragePath, dann aus ifcUrl extrahieren
        if (ifcStoragePath) {
          storagePathToUse = ifcStoragePath;
          console.log('Using provided storage path:', storagePathToUse);
        } else if (ifcUrl && storage) {
          // Versuche Storage-Pfad aus URL zu extrahieren
          try {
            const urlObj = new URL(ifcUrl);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
            if (pathMatch) {
              storagePathToUse = decodeURIComponent(pathMatch[1]);
              console.log('Extracted storage path from URL:', storagePathToUse);
            }
          } catch (e) {
            console.warn('Could not extract storage path from URL:', e);
          }
        }
        
        // Lade Datei: Verwende API-Route als Proxy (umgeht CORS-Probleme)
        // Bevorzuge signierte URL, da sie bereits ein Token enthält
        if (ifcUrl) {
          console.log('Loading file via API proxy with signed URL');
          try {
            // Verwende Next.js API-Route mit signierter URL (enthält Token)
            const apiUrl = `/api/storage?url=${encodeURIComponent(ifcUrl)}`;
            console.log('Fetching from API:', apiUrl);
            
            // Erstelle AbortController für den Request
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 Minuten Timeout
            
            try {
              const response = await fetch(apiUrl, {
                signal: abortController.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
              }
              
              const blob = await response.blob();
              console.log('Blob received, size:', blob.size);
              file = new File([blob], `model_${Date.now()}.ifc`, { type: blob.type || 'application/octet-stream' });
              console.log('File created from blob');
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout - die Datei ist zu groß oder die Verbindung zu langsam');
              }
              throw fetchError;
            }
          } catch (apiError: any) {
            console.error('Fehler beim Laden über API:', apiError);
            console.error('API error details:', {
              name: apiError?.name,
              message: apiError?.message,
              stack: apiError?.stack
            });
            
            // Fallback: Versuche Storage-Pfad NICHT, da dieser 403 gibt (keine Auth)
            // Stattdessen: Fehler werfen
            throw new Error(`Datei konnte nicht geladen werden: ${apiError?.message || 'Unbekannter Fehler'}`);
          }
        } else if (storagePathToUse) {
          console.log('Loading file via API proxy with storage path:', storagePathToUse);
          try {
            const apiUrl = `/api/storage/${storagePathToUse}`;
            console.log('Fetching from API:', apiUrl);
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log('Blob received, size:', blob.size);
            file = new File([blob], `model_${Date.now()}.ifc`, { type: blob.type || 'application/octet-stream' });
            console.log('File created from blob');
          } catch (apiError: any) {
            console.error('Fehler beim Laden über API:', apiError);
            throw new Error(`Datei konnte nicht geladen werden: ${apiError?.message || 'Unbekannter Fehler'}`);
          }
        } else if (ifcContent) {
          console.log('Loading file from content (base64)');
          file = await stringToIfcFile(ifcContent, `model_${Date.now()}.ifc`);
        } else {
          throw new Error('Keine Datei verfügbar (kein Storage-Pfad, keine URL, kein Content).');
        }

        let model: any;
        try {
          model = await newViewer.IFC.loadIfc(file, true);
        } catch (err) {
          const objectUrl = URL.createObjectURL(file);
          try {
            model = await newViewer.IFC.loadIfcUrl(objectUrl, true);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }

        try { if (model && typeof model.modelID === 'number') loadedModelIdsRef.current.push(model.modelID); } catch {}

        // ---------- Fit-to-view: berechne requiredDistance aus FOV + Aspect ----------
        const THREE: any = await import('three');
        const obj = model?.mesh ?? model?.model ?? model ?? (newViewer.context.scene);
        const box = new THREE.Box3().setFromObject(obj);

        if (box.isEmpty()) {
          try {
            obj.traverse?.((child: any) => {
              if (child.isMesh && child.geometry) {
                child.geometry.computeBoundingBox?.();
                if (child.geometry.boundingBox) {
                  box.expandByObject(child);
                }
              }
            });
          } catch {}
        }

        if (!box.isEmpty()) {
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const center = sphere.center;
          const radius = Math.max(sphere.radius, 0.001);

          console.log('IFC fit: center=', center, 'radius=', radius);

          // Y-up erzwingen
          try {
            newViewer.context.scene.up.set(0, 1, 0);
            const camAny: any = (newViewer.context as any).ifcCamera?.camera || (newViewer.context as any).getCamera?.();
            if (camAny?.up) camAny.up.set(0, 1, 0);
          } catch {}

          // Kamera aus Viewer holen
          const cam: any = (newViewer.context as any).ifcCamera?.camera || (newViewer.context as any).getCamera?.();
          const renderer: any = newViewer.context?.renderer;
          let requiredDistance = null as number | null;

          try {
            if (cam?.isPerspectiveCamera) {
              const fovDeg = cam.fov ?? 50;
              const fovRad = (fovDeg * Math.PI) / 180;
              const vHalf = fovRad / 2;
              let aspect = 1;
              try {
                const sizeVec = renderer.getSize?.(new THREE.Vector2()) ?? null;
                if (sizeVec && sizeVec.x && sizeVec.y) {
                  aspect = sizeVec.x / sizeVec.y;
                } else if (containerRef.current) {
                  aspect = Math.max(0.1, containerRef.current.clientWidth / Math.max(1, containerRef.current.clientHeight));
                }
              } catch {}
              const hHalf = Math.atan(Math.tan(vHalf) * aspect);
              const maxHalf = Math.max(vHalf, hHalf);
              const margin = 1.18;
              requiredDistance = (radius / Math.sin(maxHalf)) * margin;
            } else if (cam?.isOrthographicCamera) {
              requiredDistance = radius * 2.8;
            } else {
              requiredDistance = radius * 6;
            }
          } catch {
            requiredDistance = radius * 6;
          }

          if (!requiredDistance || !isFinite(requiredDistance) || requiredDistance <= 0) requiredDistance = Math.max(radius * 6, 5);

          // Kamerarichtung: leicht oberhalb und zurück
          const dir = new THREE.Vector3(0, 1, 1).normalize();
          const camPos = center.clone().add(dir.multiplyScalar(requiredDistance));

          // Setze Kamera *zunächst* (vorläufig)
          if (cam?.position) {
            cam.position.copy(camPos);
            cam.near = Math.max(requiredDistance / 1000, 0.01);
            cam.far = Math.max(requiredDistance * 40, 20000);
            cam.updateProjectionMatrix?.();
          }

          // Controls: setze Ziel & Limits
          const controls: any = (newViewer.context as any).ifcCamera?.controls || (newViewer.context as any).getControls?.();
          if (controls) {
            try {
              if (controls.target) controls.target.copy(center);
              else if (typeof controls.setTarget === 'function') controls.setTarget(center.x, center.y, center.z);

              if ('minDistance' in controls) controls.minDistance = Math.max(radius * 0.15, 0.05);
              if ('maxDistance' in controls) controls.maxDistance = Math.max(requiredDistance * 10, radius * 100);
              if ('maxPolarAngle' in controls) controls.maxPolarAngle = Math.PI * 0.95;
              if ('minPolarAngle' in controls) controls.minPolarAngle = 0;
              controls.enableDamping = true;
              controls.update?.();
            } catch (e) { /* ignore */ }
          }

          // WICHTIG: Viewer kann intern nachladen und eigene fit-To-Frame-Logik ausführen.
          // Daher setzen wir die finale Kamera-Position erst NACH interner Init via requestAnimationFrame,
          // so bleibt unsere berechnete Position bestehen.
          try {
            requestAnimationFrame(() => {
              try {
                // apply again to be robust vs. internal resets
                if (cam?.position) {
                  cam.position.copy(camPos);
                  cam.updateProjectionMatrix?.();
                  cam.lookAt(center.x, center.y, center.z);
                }
              } catch (e) { /* ignore */ }
              try { controls?.update?.(); } catch {}
              try { newViewer.context.resize?.(); } catch {}
            });
            // extra frame to be extra robust on some implementations
            requestAnimationFrame(() => {
              try {
                if (cam?.position) {
                  cam.position.copy(camPos);
                  cam.updateProjectionMatrix?.();
                  cam.lookAt(center.x, center.y, center.z);
                }
              } catch {}
              try { controls?.update?.(); } catch {}
              try { newViewer.context.resize?.(); } catch {}
            });
          } catch (e) {
            // fallback: normal apply (shouldn't happen)
            try { cam?.position?.copy(camPos); cam?.lookAt(center.x, center.y, center.z); } catch {}
            try { controls?.update?.(); } catch {}
          }

          console.log('IFC camera pos (computed):', cam?.position, 'requiredDistance=', requiredDistance);
        } else {
          // fallback: nur viewer.fitToFrame falls keine BoundingBox
          try { newViewer.context.fitToFrame?.(); } catch {}
        }

        // Shadows & postproduction aktualisieren falls vorhanden (keine fitToFrame danach!)
        // Prüfe, ob Modell erfolgreich geladen wurde
        if (model && (model.modelID !== undefined || model.mesh || model.model)) {
          try { await newViewer.shadowDropper?.renderShadow?.(model.modelID); } catch {}
          try { await newViewer.context.renderer.postProduction.update?.(); } catch {}
          try { newViewer.context.resize?.(); } catch {}
          
          // Bei großen Dateien: Warte auf vollständiges Rendering
          // Verwende requestAnimationFrame, um sicherzustellen, dass das Modell gerendert wird
          requestAnimationFrame(() => {
            try { newViewer.context.render?.(); } catch {}
            requestAnimationFrame(() => {
              try { newViewer.context.render?.(); } catch {}
            });
          });
          
          // Wichtig: **KEIN** neues fitToFrame() hier — das würde unsere Kamera überschreiben
          setHasModel(true);
        } else {
          console.warn('Modell wurde geladen, aber keine gültige Modell-Struktur gefunden');
          setHasModel(false);
        }
        setIsLoading(false);
      } catch (e) {
        console.error('Fehler beim Laden des IFC-Modells:', e);
        setError('Das IFC-Modell konnte nicht geladen werden.');
        setHasModel(false);
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifcContent, ifcUrl, ifcStoragePath, storage]);

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
    if (!ifcContent && !ifcUrl && !ifcStoragePath && !isLoading && !hasModel) {
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
