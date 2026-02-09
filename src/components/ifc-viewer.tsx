'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, Layers, X, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import * as THREE from 'three';

interface IfcViewerProps {
  ifcFile?: File | null;
  ifcUrl?: string | null;
  ifcStoragePath?: string | null;
  ifcContent?: string | null;
  onModelLoaded?: (structure: any) => void;
  onElementSelected?: (id: number | null) => void;
  selectedElementId?: number | null;
}

interface SelectedElement {
  modelID: number;
  id: number;
  type: string;
  props: { [key: string]: any };
  psets: { [key: string]: any }[];
}

export function IfcViewer({ ifcFile, ifcContent, ifcUrl, ifcStoragePath, onModelLoaded, onElementSelected, selectedElementId }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  const currentUrlRef = useRef<string | null>(null);

  // Use ref to avoid reloading when callback changes
  const onModelLoadedRef = useRef(onModelLoaded);
  useEffect(() => { onModelLoadedRef.current = onModelLoaded; }, [onModelLoaded]);

  // 1. INITIALISIERUNG
  useEffect(() => {
    let viewer: any = null;
    let mounted = true;

    const initViewer = async () => {
      if (!containerRef.current) return;

      try {
        let IfcViewerAPI: any;
        try {
          const mod = await import('web-ifc-viewer');
          IfcViewerAPI = (mod as any).IfcViewerAPI || (mod as any).default?.IfcViewerAPI || (mod as any).default || mod;
        } catch (err) {
          console.warn('Local import failed, trying CDN...');
          const cdnUrl = 'https://esm.sh/web-ifc-viewer@1.0.218';
          const modCdn: any = await import(/* webpackIgnore: true */ cdnUrl);
          IfcViewerAPI = modCdn?.IfcViewerAPI || modCdn?.default || modCdn;
        }

        if (!IfcViewerAPI) throw new Error('IFC Library konnte nicht geladen werden.');
        if (!mounted) return;

        viewer = new IfcViewerAPI({
          container: containerRef.current,
          backgroundColor: new THREE.Color(0xf3f4f6),
        });

        const wasmPath = `/wasm/`;
        await viewer.IFC.setWasmPath(wasmPath);

        // Renderer Fix
        try {
          const wrapperOrRenderer = viewer.context.renderer;
          if (wrapperOrRenderer) {
            const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
            if (typeof wrapperOrRenderer.setPixelRatio === 'function') {
              wrapperOrRenderer.setPixelRatio(pixelRatio);
            } else if (wrapperOrRenderer.renderer && typeof wrapperOrRenderer.renderer.setPixelRatio === 'function') {
              wrapperOrRenderer.renderer.setPixelRatio(pixelRatio);
            }
            if (wrapperOrRenderer.postProduction) {
              wrapperOrRenderer.postProduction.active = false;
            }
          }
        } catch (e) { }

        // ResizeObserver Fix
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && height < 8000) {
              try { viewer.context.resize(); } catch { }
            }
          }
        });
        ro.observe(containerRef.current);
        resizeObserverRef.current = ro;

        viewerRef.current = viewer;
        if (mounted) setIsViewerReady(true);

      } catch (e) {
        console.error("Viewer Init Error:", e);
        if (mounted) setError("Initialisierungsfehler");
      }
    };

    initViewer();

    return () => {
      mounted = false;
      setIsViewerReady(false);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (viewer) {
        try { viewer.dispose(); } catch (e) { }
      }
      viewerRef.current = null;
    };
  }, []);


  // 2. MODEL LOADING (Mit Base64 Fix)
  useEffect(() => {
    if (!isViewerReady || !viewerRef.current) return;

    const viewer = viewerRef.current;
    let isActive = true;

    const loadModel = async () => {
      setHasModel(false);
      setSelectedElement(null);
      setError(null);

      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }

      // Soft Cleanup
      try {
        const models = viewer.context.items.ifcModels;
        if (models && models.length > 0) {
          for (const model of models) {
            viewer.context.scene.remove(model);
            if (model.modelID !== undefined) {
              try { viewer.IFC.loader.ifcManager.close(model.modelID); } catch { }
            }
          }
          viewer.context.items.ifcModels = [];
        }
      } catch (e) { }

      if (!ifcFile && !ifcUrl && !ifcStoragePath && !ifcContent) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        let blobToLoad: Blob | null = null;
        let filename = 'model.ifc';

        if (ifcFile) {
          blobToLoad = ifcFile;
          filename = ifcFile.name;
        }
        else if (ifcStoragePath) {
          console.log('[IfcViewer] Lade von Supabase:', ifcStoragePath);
          const { data, error } = await supabase.storage.from('ifc-models').download(ifcStoragePath);
          if (error || !data) throw error || new Error('Keine Daten von Supabase');
          blobToLoad = data;
          filename = ifcStoragePath.split('/').pop() || 'model.ifc';
        }
        else if (ifcUrl) {
          const res = await fetch(ifcUrl);
          if (!res.ok) throw new Error('Fetch fehlgeschlagen');
          blobToLoad = await res.blob();
        }

        if (!blobToLoad) throw new Error("Keine Datei gefunden.");

        // ---------------------------------------------------------
        // FIX: Base64 Data URI Check & Decode
        // ---------------------------------------------------------
        const headerCheck = await blobToLoad.slice(0, 50).text();

        if (headerCheck.startsWith('data:')) {
          console.log('[IfcViewer] Data-URI (Base64) erkannt. Starte Umwandlung in Binärdaten...');
          const fullText = await blobToLoad.text();
          // Format ist meist: "data:application/octet-stream;base64,....."
          const parts = fullText.split(',');
          if (parts.length === 2) {
            const base64 = parts[1];
            const binaryString = atob(base64); // Base64 decode
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            // Ersetze den Blob durch den "echten" decodierten Blob
            blobToLoad = new Blob([bytes], { type: 'application/x-step' });
            console.log('[IfcViewer] Umwandlung erfolgreich. Neue Größe:', blobToLoad.size);
          } else {
            console.warn('[IfcViewer] Data-URI Format unerwartet, versuche Original...');
          }
        }
        // ---------------------------------------------------------

        const modelUrl = URL.createObjectURL(blobToLoad);
        currentUrlRef.current = modelUrl;

        console.log(`[IfcViewer] Lade URL: ${modelUrl}`);
        const model = await viewer.IFC.loadIfcUrl(modelUrl, true);

        if (isActive && model) {
          setHasModel(true);
          // Spatial Structure Extraction
          if (onModelLoadedRef.current) {
            try {
              const structure = await viewer.IFC.getSpatialStructure(model.modelID);
              onModelLoadedRef.current(structure);
            } catch (e) {
              console.error("Structure extraction failed", e);
            }
          }
        }

      } catch (e: any) {
        console.error("[IfcViewer] Ladefehler:", e);
        if (isActive) {
          setError(e.message || "Modell konnte nicht geladen werden.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadModel();

    return () => { isActive = false; };

  }, [ifcFile, ifcUrl, ifcStoragePath, ifcContent, isViewerReady]);


  // 2.5 EXTERNAL SELECTION SYNC
  useEffect(() => {
    if (!viewerRef.current || !hasModel) return;
    const viewer = viewerRef.current;

    const highlightExternal = async () => {
      if (selectedElementId) {
        try {
          // Check type to prevent focusing on spatial structures (Project, Site, etc.) which kills the camera
          let typeName = 'Unknown';
          try {
            typeName = await viewer.IFC.loader.ifcManager.getIfcType(0, selectedElementId);
            typeName = typeName.toUpperCase();
          } catch (e) {
            console.warn("Could not get type for selection", e);
          }

          const isSpatial = ['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY'].includes(typeName);
          const shouldFocus = !isSpatial;

          // Important: Pick without event first to clear previous
          await viewer.IFC.selector.pickIfcItemsByID(0, [selectedElementId], shouldFocus);

          // Also get properties for overlay
          const props = await viewer.IFC.getProperties(0, selectedElementId, true);

          let psets = [];
          try { psets = await viewer.IFC.loader.ifcManager.getPropertySets(0, selectedElementId, true); } catch { }

          setSelectedElement({ modelID: 0, id: selectedElementId, type: typeName, props: props || {}, psets: psets || [] });
        } catch (e) { console.warn("External pick failed", e); }
      } else {
        // If selectedElementId is null, deselect
        await viewer.IFC.selector.unpickIfcItems();
        setSelectedElement(null);
      }
    };
    highlightExternal();
  }, [selectedElementId, hasModel]);


  // 3. INTERAKTION
  const handleDoubleClick = async () => {
    if (!viewerRef.current || !hasModel) return;
    const viewer = viewerRef.current;
    try {
      const result = await viewer.IFC.selector.pickIfcItem(true);
      if (!result) {
        await viewer.IFC.selector.unpickIfcItems();
        setSelectedElement(null);
        return;
      }
      const { modelID, id } = result;

      // Notify parent
      if (onElementSelected) {
        onElementSelected(id);
      }

      const props = await viewer.IFC.getProperties(modelID, id, true);
      let typeName = 'Unknown';
      try { typeName = await viewer.IFC.loader.ifcManager.getIfcType(modelID, id); } catch { }

      let psets = [];
      try { psets = await viewer.IFC.loader.ifcManager.getPropertySets(modelID, id, true); } catch { }

      setSelectedElement({ modelID, id, type: typeName, props: props || {}, psets: psets || [] });
    } catch (e) { console.warn("Selection error", e); }
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object' && val.value !== undefined) return String(val.value);
    return String(val);
  };

  const renderOverlay = () => {
    if (isLoading) return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4 z-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="font-semibold">Lade Modell...</p>
      </div>
    );
    if (error) return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4 z-20">
        <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
        <p className="font-semibold text-destructive">Fehler</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
    if (!hasModel && !isLoading) return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-md text-center p-4 z-10 pointer-events-none">
        <Layers className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="font-semibold text-muted-foreground">Kein Modell geladen</p>
      </div>
    );
    return null;
  };

  const renderSelectionInfo = () => {
    if (!selectedElement) return null;
    return (
      <div className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] flex flex-col bg-card/95 backdrop-blur shadow-lg rounded-lg border overflow-hidden animate-in fade-in slide-in-from-right-5 z-30">
        <div className="p-3 border-b flex items-start justify-between bg-muted/50">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              {selectedElement.type}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">ID: {selectedElement.props.GlobalId?.value || selectedElement.props.GlobalId || '-'}</p>
          </div>
          <button
            onClick={() => {
              viewerRef.current?.IFC?.selector?.unpickIfcItems();
              setSelectedElement(null);
              if (onElementSelected) onElementSelected(null);
            }}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 text-xs space-y-4">
          <div>
            <strong className="block mb-1 text-primary">Basisdaten</strong>
            <div className="grid grid-cols-[1fr_2fr] gap-1">
              <span className="text-muted-foreground">Name:</span>
              <span className="break-all">{formatValue(selectedElement.props.Name)}</span>
              <span className="text-muted-foreground">Tag:</span>
              <span className="break-all">{formatValue(selectedElement.props.Tag) || selectedElement.id}</span>
            </div>
          </div>
          {selectedElement.psets.length > 0 && (
            <div>
              <strong className="block mb-2 text-primary border-b pb-1">Property Sets</strong>
              <div className="space-y-3">
                {selectedElement.psets.map((pset, idx) => (
                  <div key={idx} className="bg-muted/30 p-2 rounded">
                    <span className="font-medium block mb-1 text-foreground/80">{formatValue(pset.Name)}</span>
                    <div className="space-y-1 pl-1">
                      {pset.HasProperties?.map((prop: any, pIdx: number) => (
                        <div key={pIdx} className="grid grid-cols-[1fr_2fr] gap-x-2 border-l-2 border-border pl-2 mb-1">
                          <span className="text-muted-foreground break-words">{formatValue(prop.Name)}:</span>
                          <span className="font-mono text-foreground/90 break-words">{formatValue(prop.NominalValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="flex flex-col h-[600px] md:h-[calc(100vh-100px)] min-h-0 relative">
      <CardHeader>
        <CardTitle className="font-headline">3D-Modell-Ansicht</CardTitle>
        <CardDescription>Interaktive Ansicht Ihres IFC-Modells (IFC.js).</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 relative overflow-hidden p-0 bg-muted/30">
        <div
          ref={containerRef}
          onDoubleClick={handleDoubleClick}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />
        {renderOverlay()}
        {renderSelectionInfo()}
      </CardContent>
    </Card>
  );
}

export default IfcViewer;