/**
 * @fileOverview IFC-Parser für kompakte JSON-Struktur
 * 
 * Konvertiert IFC-Dateien in eine kompakte JSON-Struktur für KI-Analyse.
 * Verwendet web-ifc für das Parsing.
 */

// web-ifc wird dynamisch importiert, da es WASM benötigt

/**
 * Kompakte Bounding-Box-Struktur
 */
export interface CompactBBox {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

/**
 * Kompaktes IFC-Element
 */
export interface CompactElement {
  id: string;
  type: string; // z.B. "IfcWall", "IfcSlab", "IfcDoor"
  name?: string;
  material?: string;
  materialCategory?: string;
  bbox?: CompactBBox;
  parentId?: string; // ID des übergeordneten Elements (z.B. Geschoss)
  properties?: Record<string, any>; // Optionale Properties wie fireRating, Nutzung, etc.
  quantities?: {
    area?: number;
    volume?: number;
    length?: number;
  };
}

/**
 * Kompaktes Material
 */
export interface CompactMaterial {
  name: string;
  category?: string;
  usage?: string; // z.B. "Wand", "Decke", "Fundament"
}

/**
 * Kompaktes IFC-Modell für KI-Analyse
 */
export interface CompactIFCModel {
  elements: CompactElement[];
  materials: CompactMaterial[];
  metadata?: {
    projectName?: string;
    buildingName?: string;
    storeys?: string[]; // Liste der Geschosse
  };
}

/**
 * Extrahiert Materialname aus IFC-Material
 */
function extractMaterialName(ifcMaterial: any): string | undefined {
  if (!ifcMaterial) return undefined;

  // Material kann verschiedene Strukturen haben
  if (typeof ifcMaterial === 'string') return ifcMaterial;
  if (ifcMaterial.Name?.value) return ifcMaterial.Name.value;
  if (ifcMaterial.name) return ifcMaterial.name;
  if (ifcMaterial.Material) {
    if (ifcMaterial.Material.Name?.value) return ifcMaterial.Material.Name.value;
    if (ifcMaterial.Material.name) return ifcMaterial.Material.name;
  }

  return undefined;
}

// Hilfsfunktion: sichere Konvertierung von GetLineIDsWithType-Ausgaben zu Array
function toIterable(x: any): any[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  try {
    if (typeof x[Symbol.iterator] === 'function') return Array.from(x as Iterable<any>);
  } catch (e) {
    // ignore
  }
  if (typeof x === 'object') return Object.values(x);
  return [x];
}

/**
 * Extrahiert Properties aus IFC-Element
 */
async function extractProperties(
  ifcAPI: any, // WebIFC.IfcAPI, aber dynamisch importiert
  expressID: number,
  WebIFC: any
): Promise<Record<string, any> | undefined> {
  try {
    const propertiesRaw = await ifcAPI.GetLineIDsWithType(
      ifcAPI.modelID,
      WebIFC.IFCRELDEFINESBYPROPERTIES
    );
    const properties = toIterable(propertiesRaw);

    const props: Record<string, any> = {};

    for (const propID of properties) {
      const relProps = await ifcAPI.GetLine(ifcAPI.modelID, propID);

      if (relProps.RelatedObjects && Array.isArray(relProps.RelatedObjects)) {
        const relatedIds = relProps.RelatedObjects.map((ref: any) =>
          typeof ref === 'object' && ref.value !== undefined ? ref.value : ref
        );

        if (relatedIds.includes(expressID)) {
          const propSetID = relProps.RelatingPropertyDefinition?.value;
          if (propSetID) {
            const propSet = await ifcAPI.GetLine(ifcAPI.modelID, propSetID);

            if (propSet.HasProperties && Array.isArray(propSet.HasProperties)) {
              for (const propRef of propSet.HasProperties) {
                const propLineID = propRef?.value || propRef;
                const prop = await ifcAPI.GetLine(ifcAPI.modelID, propLineID);

                if (prop.Name?.value || prop.name) {
                  const propName = prop.Name?.value || prop.name;
                  const propValue = prop.NominalValue?.value ||
                    prop.value ||
                    prop.IfcTextLiteral?.value ||
                    prop.IfcLabel?.value ||
                    prop.IfcReal?.value ||
                    prop.IfcInteger?.value ||
                    prop.IfcBoolean?.value ||
                    prop.IfcIdentifier?.value ||
                    prop.IfcTimeStamp?.value ||
                    undefined;

                  if (propValue !== undefined) {
                    props[propName] = propValue;
                  }
                }
              }
            }
          }
        }
      }
    }

    return Object.keys(props).length > 0 ? props : undefined;
  } catch (error) {
    console.warn('Fehler beim Extrahieren von Properties:', error);
    return undefined;
  }
}

/**
 * Extrahiert Quantities aus IFC-Element
 */
async function extractQuantities(
  ifcAPI: any, // WebIFC.IfcAPI, aber dynamisch importiert
  expressID: number,
  WebIFC: any
): Promise<CompactElement['quantities'] | undefined> {
  try {
    // Collect quantity sets from multiple possible IDs to support both IFC2x3 and IFC4 robustly
    // 144 = IFC4 IFCRELDEFINESBYQUANTITY
    // 123 = IFC2x3 IFCRELDEFINESBYQUANTITY
    // Using constant if available, otherwise fallback to numbers

    let quantitiesRaw: number[] = [];

    // Try getting via constant
    if (WebIFC && WebIFC.IFCRELDEFINESBYQUANTITY) {
      try {
        const result = await ifcAPI.GetLineIDsWithType(ifcAPI.modelID, WebIFC.IFCRELDEFINESBYQUANTITY);
        quantitiesRaw.push(...toIterable(result));
      } catch (e) { console.warn('GetLineIDsWithType failed for constant IFCRELDEFINESBYQUANTITY', e); }
    } else {
      // Fallback to numeric IDs
      const candidates = [144, 123];
      for (const typeID of candidates) {
        try {
          const result = await ifcAPI.GetLineIDsWithType(ifcAPI.modelID, typeID);
          quantitiesRaw.push(...toIterable(result));
        } catch (e) {
          // ignore specific type error
        }
      }
    }

    // Deduplicate IDs
    const quantities = Array.from(new Set(quantitiesRaw));

    const result: CompactElement['quantities'] = {};

    for (const qtyID of quantities) {
      const relQty = await ifcAPI.GetLine(ifcAPI.modelID, qtyID);

      if (relQty.RelatedObjects && Array.isArray(relQty.RelatedObjects)) {
        const relatedIds = relQty.RelatedObjects.map((ref: any) =>
          typeof ref === 'object' && ref.value !== undefined ? ref.value : ref
        );

        if (relatedIds.includes(expressID)) {
          const elemQtyID = relQty.RelatingPropertyDefinition?.value;
          if (elemQtyID) {
            const elemQty = await ifcAPI.GetLine(ifcAPI.modelID, elemQtyID);

            if (elemQty.Quantities && Array.isArray(elemQty.Quantities)) {
              for (const qtyRef of elemQty.Quantities) {
                const qtyLineID = qtyRef?.value || qtyRef;
                const qty = await ifcAPI.GetLine(ifcAPI.modelID, qtyLineID);

                const qtyType = qty.constructor.name;
                const qtyName = qty.Name?.value || qty.name || '';

                if (qtyType === 'IFCQUANTITYAREA' && qtyName.toLowerCase().includes('area')) {
                  result.area = qty.AreaValue?.value || qty.value;
                } else if (qtyType === 'IFCQUANTITYVOLUME' && qtyName.toLowerCase().includes('volume')) {
                  result.volume = qty.VolumeValue?.value || qty.value;
                } else if (qtyType === 'IFCQUANTITYLENGTH' && qtyName.toLowerCase().includes('length')) {
                  result.length = qty.LengthValue?.value || qty.value;
                }
              }
            }
          }
        }
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  } catch (error) {
    console.warn('Fehler beim Extrahieren von Quantities:', error);
    return undefined;
  }
}

/**
 * Berechnet Bounding Box aus IFC-Geometrie
 */
function calculateBBox(geometry: any): CompactBBox | undefined {
  try {
    if (!geometry) return undefined;

    // web-ifc gibt normalerweise bereits eine BBox oder wir müssen sie berechnen
    // Für jetzt verwenden wir eine vereinfachte Methode
    // In Produktion sollte man die tatsächliche Geometrie analysieren

    // Falls bereits eine BBox vorhanden ist
    if (geometry.bbox) {
      const bbox = geometry.bbox;
      const min: [number, number, number] = [
        bbox.min?.x || bbox.min?.X || bbox[0] || 0,
        bbox.min?.y || bbox.min?.Y || bbox[1] || 0,
        bbox.min?.z || bbox.min?.Z || bbox[2] || 0,
      ];
      const max: [number, number, number] = [
        bbox.max?.x || bbox.max?.X || bbox[3] || 0,
        bbox.max?.y || bbox.max?.Y || bbox[4] || 0,
        bbox.max?.z || bbox.max?.Z || bbox[5] || 0,
      ];

      const center: [number, number, number] = [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      ];

      const size: [number, number, number] = [
        max[0] - min[0],
        max[1] - min[1],
        max[2] - min[2],
      ];

      return { min, max, center, size };
    }

    return undefined;
  } catch (error) {
    console.warn('Fehler beim Berechnen der Bounding Box:', error);
    return undefined;
  }
}

/**
 * Extrahiert Parent-ID (z.B. Geschoss) aus IFC-Element
 */
async function extractParentId(
  ifcAPI: any, // WebIFC.IfcAPI, aber dynamisch importiert
  expressID: number,
  WebIFC: any
): Promise<string | undefined> {
  try {
    // Suche nach IFCRELAGGREGATES, um Hierarchie zu finden
    const aggregatesRaw = await ifcAPI.GetLineIDsWithType(
      ifcAPI.modelID,
      WebIFC.IFCRELAGGREGATES
    );
    const aggregates = toIterable(aggregatesRaw);

    for (const aggID of aggregates) {
      const rel = await ifcAPI.GetLine(ifcAPI.modelID, aggID);

      if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
        const relatedIds = rel.RelatedObjects.map((ref: any) =>
          typeof ref === 'object' && ref.value !== undefined ? ref.value : ref
        );

        if (relatedIds.includes(expressID)) {
          const parentRef = rel.RelatingObject;
          if (parentRef) {
            const parentID = typeof parentRef === 'object' && parentRef.value !== undefined
              ? parentRef.value
              : parentRef;
            return parentID.toString();
          }
        }
      }
    }

    return undefined;
  } catch (error) {
    console.warn('Fehler beim Extrahieren der Parent-ID:', error);
    return undefined;
  }
}

/**
 * Konvertiert vollständiges IFC-Modell in kompakte Struktur
 */
export async function toCompactModel(
  ifcAPI: any, // WebIFC.IfcAPI, aber dynamisch importiert
  modelID: number,
  WebIFC: any
): Promise<CompactIFCModel> {
  const elements: CompactElement[] = [];
  const materialsMap = new Map<string, CompactMaterial>();
  const storeys: string[] = [];

  // Liste der relevanten IFC-Elementtypen
  const elementTypes = [
    WebIFC.IFCWALL,
    WebIFC.IFCWALLSTANDARDCASE,
    WebIFC.IFCSLAB,
    WebIFC.IFCDOOR,
    WebIFC.IFCWINDOW,
    WebIFC.IFCCOLUMN,
    WebIFC.IFCBEAM,
    WebIFC.IFCROOF,
    WebIFC.IFCSTAIR,
    WebIFC.IFCBUILDINGSTOREY,
    WebIFC.IFCBUILDING,
    WebIFC.IFCPROJECT,
  ];

  // Sammle alle relevanten Elemente
  for (const elementType of elementTypes) {
    try {
      const elementIDsRaw = await ifcAPI.GetLineIDsWithType(modelID, elementType);
      const elementIDs = toIterable(elementIDsRaw);

      for (const expressID of elementIDs) {
        try {
          const element = await ifcAPI.GetLine(modelID, expressID);
          const elementTypeName = element.constructor.name;

          // Überspringe Container-Elemente für die Hauptliste (behalten aber für Metadaten)
          if (elementTypeName === 'IFCPROJECT') {
            continue;
          }

          if (elementTypeName === 'IFCBUILDINGSTOREY') {
            const storeyName = element.Name?.value || element.name || `Geschoss-${expressID}`;
            storeys.push(storeyName);
            continue;
          }

          if (elementTypeName === 'IFCBUILDING') {
            continue;
          }

          // Extrahiere Basisdaten
          const name = element.Name?.value || element.name || undefined;
          const id = expressID.toString();

          // Extrahiere Material
          let material: string | undefined;
          let materialCategory: string | undefined;

          try {
            // Versuche Material über HasAssociations zu finden
            const associationsRaw = await ifcAPI.GetLineIDsWithType(
              modelID,
              WebIFC.IFCRELASSOCIATESMATERIAL
            );
            const associations = toIterable(associationsRaw);

            for (const assocID of associations) {
              const assoc = await ifcAPI.GetLine(modelID, assocID);

              if (assoc.RelatedObjects && Array.isArray(assoc.RelatedObjects)) {
                const relatedIds = assoc.RelatedObjects.map((ref: any) =>
                  typeof ref === 'object' && ref.value !== undefined ? ref.value : ref
                );

                if (relatedIds.includes(expressID)) {
                  const matSelect = assoc.RelatingMaterial;
                  if (matSelect) {
                    const matRef = matSelect.value || matSelect;
                    const mat = await ifcAPI.GetLine(modelID, matRef);

                    material = extractMaterialName(mat);
                    if (material) {
                      materialCategory = elementTypeName.replace('IFC', '');
                      materialsMap.set(material, {
                        name: material,
                        category: materialCategory,
                        usage: elementTypeName.replace('IFC', ''),
                      });
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`Fehler beim Extrahieren von Material für ${id}:`, error);
          }

          // Extrahiere Properties
          const properties = await extractProperties(ifcAPI, expressID, WebIFC);

          // Extrahiere Quantities
          const quantities = await extractQuantities(ifcAPI, expressID, WebIFC);

          // Extrahiere Parent-ID (Geschoss, etc.)
          const parentId = await extractParentId(ifcAPI, expressID, WebIFC);

          // Versuche Bounding Box zu berechnen (vereinfacht)
          // In Produktion sollte man die tatsächliche Geometrie laden
          let bbox: CompactBBox | undefined;
          try {
            // web-ifc hat GetBoundingBox, aber das funktioniert nur mit geladener Geometrie
            // Für kompakte Version ohne Geometrie-Vertices verwenden wir eine vereinfachte Methode
          } catch (error) {
            // BBox optional, Fehler ignorieren
          }

          elements.push({
            id,
            type: elementTypeName,
            name,
            material,
            materialCategory,
            bbox,
            parentId,
            properties,
            quantities,
          });
        } catch (error) {
          console.warn(`Fehler beim Verarbeiten von Element ${expressID}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Fehler beim Verarbeiten von Elementtyp ${elementType}:`, error);
    }
  }

  // Konvertiere Materials-Map zu Array
  const materials = Array.from(materialsMap.values());

  // Extrahiere Metadaten
  try {
    const projectsRaw = await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    const buildingsRaw = await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCBUILDING);
    const projects = toIterable(projectsRaw);
    const buildings = toIterable(buildingsRaw);

    const projectName = projects.length > 0
      ? (await ifcAPI.GetLine(modelID, projects[0])).Name?.value || undefined
      : undefined;

    const buildingName = buildings.length > 0
      ? (await ifcAPI.GetLine(modelID, buildings[0])).Name?.value || undefined
      : undefined;

    return {
      elements,
      materials,
      metadata: {
        projectName,
        buildingName,
        storeys: storeys.length > 0 ? storeys : undefined,
      },
    };
  } catch (error) {
    console.warn('Fehler beim Extrahieren von Metadaten:', error);
    return {
      elements,
      materials,
    };
  }
}

/**
 * Parst IFC-Datei in kompaktes JSON-Modell
 * 
 * @param file - IFC-Datei als File oder Buffer
 * @returns Kompaktes IFC-Modell als JSON
 */
export async function parseIFC(
  file: File | Buffer | ArrayBuffer | Uint8Array | Blob
): Promise<CompactIFCModel> {
  // Dynamisch importieren (client-side nur)
  if (typeof window === 'undefined') {
    throw new Error('IFC-Parsing ist nur im Browser (client-side) möglich, da web-ifc WASM benötigt.');
  }

  // Dynamisch importieren von web-ifc
  const WebIFC = await import('web-ifc');

  // Initialisiere web-ifc
  const ifcAPI = new WebIFC.IfcAPI();

  try {
    // Setze WASM-Pfad - wichtig für Initialisierung
    // Im Browser verwenden wir den relativen Pfad
    const wasmPath = (window as any).WEBIFC_PATH
      || (window as any).webIfcWasmPath
      || (window as any).ifcjsWasmPath
      || '/wasm/';

    console.log('Initialisiere WASM mit Pfad:', wasmPath);

    // WICHTIG: SetWasmPath muss vollständig abgeschlossen sein, bevor wir wasmModule verwenden
    // SetWasmPath gibt ein Promise zurück, das erst resolved wird, wenn WASM geladen ist
    try {
      // Versuche SetWasmPath - danach initialisiere das WASM-Modul mittels Init()
      // (web-ifc erwartet üblicherweise einen Init-Aufruf, der das WASM-Modul lädt)
      try {
        ifcAPI.SetWasmPath(wasmPath);
        // Wenn Init() verfügbar ist, warte auf dessen Abschluss
        if (typeof (ifcAPI as any).Init === 'function') {
          await (ifcAPI as any).Init();
        }

        const finalWasmModule = (ifcAPI as any).wasmModule;
        if (finalWasmModule === undefined || finalWasmModule === null) {
          console.error('❌ WASM-Modul konnte nicht geladen werden (nach Init)');
          console.error('WASM-Modul Status:', {
            wasmModule: finalWasmModule,
            hasWasm: !!(ifcAPI as any).wasm,
            hasGetModel: typeof (ifcAPI as any).GetModel === 'function',
            hasOpenModel: typeof (ifcAPI as any).OpenModel === 'function',
            ifcAPIKeys: Object.keys(ifcAPI).slice(0, 20),
            wasmPath: wasmPath,
          });
          try {
            const wasmUrl = `${wasmPath}web-ifc.wasm`;
            const response = await fetch(wasmUrl, { method: 'HEAD' });
            console.error('WASM-Datei Check:', { url: wasmUrl, exists: response.ok, status: response.status });
          } catch (fetchError) {
            console.error('Konnte WASM-Datei nicht prüfen:', fetchError);
          }
          throw new Error(`WASM-Modul konnte nicht geladen werden. Bitte prüfen Sie die Browser-Konsole.`);
        }

        console.log('✅ WASM-Modul bereit, kann OpenModel aufrufen');
      } catch (wasmError) {
        throw wasmError;
      }
    } catch (wasmError) {
      console.error('❌ Fehler beim WASM-Initialisierung:', wasmError);
      console.error('WASM-Pfad:', wasmPath);
      console.error('Window-WASM-Pfade:', {
        WEBIFC_PATH: (window as any).WEBIFC_PATH,
        webIfcWasmPath: (window as any).webIfcWasmPath,
        ifcjsWasmPath: (window as any).ifcjsWasmPath,
      });

      // Versuche, mehr Debug-Informationen zu liefern
      if (wasmError instanceof Error) {
        console.error('WASM-Fehler Details:', {
          message: wasmError.message,
          stack: wasmError.stack,
          name: wasmError.name,
        });
      }

      throw new Error(
        `WASM konnte nicht initialisiert werden: ${wasmError instanceof Error ? wasmError.message : 'Unbekannter Fehler'}. ` +
        `Bitte prüfen Sie die Browser-Konsole für Details.`
      );
    }

    // Öffne IFC-Modell
    let data: Uint8Array;

    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      data = new Uint8Array(arrayBuffer);
    } else if (file instanceof Blob) {
      const arrayBuffer = await file.arrayBuffer();
      data = new Uint8Array(arrayBuffer);
    } else if (file instanceof Buffer) {
      data = new Uint8Array(file);
    } else if (file instanceof ArrayBuffer) {
      data = new Uint8Array(file);
    } else {
      data = file;
    }

    // Diagnose: entferne ggf. UTF-8 BOM (0xEF,0xBB,0xBF)
    try {
      // Wenn die Datei als Data-URI (text) vorliegt, dekodiere Base64
      try {
        const headerPreview = new TextDecoder().decode(data.slice(0, 64));
        const dataUriMatch = headerPreview.match(/^data:([^;]+);base64,/i);
        if (dataUriMatch) {
          console.log('IFC parser: Data-URI erkannt, dekodiere Base64 payload');
          // Gesamten Text dekodieren und Base64-Teil extrahieren
          const fullText = new TextDecoder().decode(data);
          const commaIndex = fullText.indexOf(',');
          const b64 = fullText.slice(commaIndex + 1);
          // atob -> binary string -> Uint8Array
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          data = bytes;
        }
      } catch (e) {
        // ignore data-uri detection errors
      }

      if (data && data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
        console.log('IFC parser: UTF-8 BOM gefunden, entferne BOM');
        data = data.slice(3);
      }

      // Log eine kurze Header-Vorschau zur Diagnose (erste 200 Bytes als Text)
      try {
        const preview = new TextDecoder().decode(data.slice(0, 200));
        console.log('IFC header preview:', preview.replace(/\r|\n/g, ' | '));
      } catch (e) {
        console.warn('Konnte Header-Vorschau nicht decodieren', e);
      }
    } catch (e) {
      console.warn('Fehler bei BOM-Prüfung / Header-Diagnose', e);
    }

    // Öffne Modell (ohne Geometrie für Performance)
    // Wir laden nur die Struktur, keine Geometrie-Vertices
    const modelID = await ifcAPI.OpenModel(data, {
      COORDINATE_TO_ORIGIN: false,
      USE_FAST_BOOLS: false,
      CIRCLE_SEGMENTS_LOW: 8,
      CIRCLE_SEGMENTS_MEDIUM: 16,
      CIRCLE_SEGMENTS_HIGH: 32,
    });
    // Wichtig: einige Hilfsfunktionen nutzen `ifcAPI.modelID` intern.
    try {
      // Setze modelID auf das ifcAPI-Objekt, damit andere Helfer darauf zugreifen können
      try { (ifcAPI as any).modelID = modelID; } catch { }
      console.log('IFC OpenModel returned modelID:', modelID);

      // Kurze Diagnose: zähle einige wichtige IFC-Typen
      try {
        const diagTypes = [
          WebIFC.IFCPROJECT,
          WebIFC.IFCBUILDING,
          WebIFC.IFCBUILDINGSTOREY,
          WebIFC.IFCWALL,
          WebIFC.IFCSLAB,
          WebIFC.IFCCOLUMN,
          WebIFC.IFCBEAM,
          WebIFC.IFCDOOR,
          WebIFC.IFCWINDOW,
        ];

        for (const t of diagTypes) {
          try {
            const idsRaw = await ifcAPI.GetLineIDsWithType(modelID, t);
            const ids = toIterable(idsRaw);
            console.log('IFC diag type', t, '-> count', ids.length);
          } catch (e) {
            console.warn('IFC diag: GetLineIDsWithType failed for type', t, e);
          }
        }
      } catch (e) {
        console.warn('IFC diag counts failed', e);
      }
    } catch (e) {
      console.warn('Could not set ifcAPI.modelID for helper functions', e);
    }

    try {
      // Konvertiere zu kompakter Struktur
      const compactModel = await toCompactModel(ifcAPI, modelID, WebIFC);

      return compactModel;
    } finally {
      // Schließe Modell
      await ifcAPI.CloseModel(modelID);
    }
  } catch (error) {
    console.error('Fehler beim Parsen der IFC-Datei:', error);
    throw new Error(`IFC-Parsing fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

/**
 * Konvertiert kompaktes IFC-Modell zu JSON-String für KI
 */
export function toJSONString(model: CompactIFCModel): string {
  return JSON.stringify(model, null, 0); // Keine Formatierung für Kompaktheit
}

