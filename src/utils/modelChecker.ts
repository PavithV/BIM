/**
 * @fileOverview Model Checker, DIN 277 Flächenauswertung & DIN 276 Mengenauswertung
 *
 * Analysiert ein geladenes IFC-Modell (via web-ifc API) und gibt
 * strukturierte Ergebnisse für Qualitätsprüfungen, Flächenauswertung
 * und Kostengruppen-Klassifizierung zurück.
 */

import { toCompactModel } from './ifcParser';
import { assignDIN276CostGroups, calculateDIN276Quantities, type Din276QuantityResult } from './din276Mapper';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Ergebnis der Material-Prüfung pro Elementtyp */
export interface MaterialCheckEntry {
  elementType: string; // z.B. "IfcWall"
  total: number;
  withMaterial: number;
  withoutMaterial: number;
  idsWithoutMaterial: number[];
}

/** Ergebnis der Modellprüfung */
export interface ModelCheckResult {
  ifcVersion: string | null;
  creationDate: string | null;
  projectName: string | null;
  spacesExist: boolean;
  spaceCount: number;
  unnamedSpaceCount: number;
  materialChecks: MaterialCheckEntry[];
}

/** DIN 277 Flächenkategorie */
export type Din277Category = 'NUF' | 'VF' | 'TF';

/** Einzelner Raum mit Flächen und Kategorie */
export interface SpaceInfo {
  expressID: number;
  name: string | null;
  longName: string | null;
  netFloorArea: number | null;
  grossFloorArea: number | null;
  volume: number | null;
  din277Category: Din277Category;
}

/** Aggregierte DIN 277 Zusammenfassung */
export interface Din277Summary {
  bgf: number; // Bruttogrundfläche (Summe GrossFloorArea)
  nrf: number; // Nettoraumfläche (= NUF + TF + VF)
  nuf: number; // Nutzungsfläche
  tf: number;  // Technikfläche
  vf: number;  // Verkehrsfläche
}

/** DIN 277 Gesamtergebnis */
export interface Din277Result {
  spaces: SpaceInfo[];
  summary: Din277Summary;
}

/** Gesamtergebnis der Modellanalyse */
export interface FullModelAnalysis {
  modelCheck: ModelCheckResult;
  din277: Din277Result;
  din276: Din276QuantityResult | null;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Konvertiert web-ifc-Rückgaben (Set/ExpressIDSet/IfcLineSet) sicher zu einem Array */
function toIterable(x: any): any[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  // web-ifc IfcLineSet: hat .size() und .get(i) Methoden
  if (typeof x.size === 'function' && typeof x.get === 'function') {
    const arr: any[] = [];
    const len = x.size();
    for (let i = 0; i < len; i++) {
      arr.push(x.get(i));
    }
    return arr;
  }
  try {
    if (typeof x[Symbol.iterator] === 'function') return Array.from(x as Iterable<any>);
  } catch { /* ignore */ }
  if (typeof x === 'object') return Object.values(x);
  return [x];
}

/** Extrahiert einen rohen Wert aus web-ifc Property-Wrappern */
function unwrap(v: any): any {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

// ─── DIN 277 Heuristik ──────────────────────────────────────────────────────

const VF_KEYWORDS = ['flur', 'treppe', 'korridor', 'gang', 'treppenhaus', 'aufzug', 'elevator', 'lobby', 'foyer', 'eingang'];
const TF_KEYWORDS = ['technik', 'heizung', 'lüftung', 'hausanschluss', 'elektro', 'server', 'hvac', 'mechanical', 'sprinkler'];

function classifySpace(name: string | null, longName: string | null): Din277Category {
  const searchText = `${name ?? ''} ${longName ?? ''}`.toLowerCase();
  if (VF_KEYWORDS.some(kw => searchText.includes(kw))) return 'VF';
  if (TF_KEYWORDS.some(kw => searchText.includes(kw))) return 'TF';
  return 'NUF';
}

// ─── Modellprüfung ───────────────────────────────────────────────────────────

/**
 * Führt Qualitäts- und Vollständigkeitsprüfungen am IFC-Modell durch.
 */
export async function runModelChecks(
  ifcAPI: any,
  modelID: number,
  WebIFC: any,
  rawData?: Uint8Array
): Promise<ModelCheckResult> {
  let ifcVersion: string | null = null;
  let creationDate: string | null = null;
  let projectName: string | null = null;

  // 1. IFC-Version & Metadaten aus IfcProject
  try {
    console.log('[ModelChecker] WebIFC.IFCPROJECT =', WebIFC.IFCPROJECT);
    const projectIDsRaw = await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    console.log('[ModelChecker] IFCPROJECT raw:', projectIDsRaw, 'type:', typeof projectIDsRaw, 'constructor:', projectIDsRaw?.constructor?.name);
    const projectIDs = toIterable(projectIDsRaw);
    console.log('[ModelChecker] IFCPROJECT IDs:', projectIDs, 'count:', projectIDs.length);
    if (projectIDs.length > 0) {
      const project = await ifcAPI.GetLine(modelID, projectIDs[0]);
      console.log('[ModelChecker] IfcProject data:', project);
      projectName = unwrap(project.Name) ?? unwrap(project.LongName) ?? null;
    }
  } catch (e) {
    console.warn('[ModelChecker] Fehler beim Lesen von IfcProject:', e);
  }

  // Header-Informationen aus rohen Datei-Bytes parsen (zuverlässiger als GetHeaderLine)
  if (rawData) {
    try {
      // Lese die ersten 4KB als Text für Header-Parsing
      const headerText = new TextDecoder('utf-8', { fatal: false }).decode(rawData.slice(0, 4096));

      // FILE_SCHEMA(('IFC4')) oder FILE_SCHEMA(('IFC2X3'))
      const schemaMatch = headerText.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
      if (schemaMatch) {
        ifcVersion = schemaMatch[1];
        console.log('[ModelChecker] Schema aus Header:', ifcVersion);
      }

      // FILE_NAME('...','2016-12-21T17:54:06',...) → 2. Argument ist Datum
      const dateMatch = headerText.match(/FILE_NAME\s*\([^,]*,\s*'([^']+)'/i);
      if (dateMatch) {
        creationDate = dateMatch[1];
        console.log('[ModelChecker] Erstellungsdatum aus Header:', creationDate);
      }
    } catch (e) {
      console.warn('[ModelChecker] Konnte Header nicht parsen:', e);
    }
  }

  // Fallback: Versuche web-ifc GetHeaderLine API
  if (!ifcVersion) {
    try {
      const schemaLine = await ifcAPI.GetHeaderLine(modelID, 2);
      if (schemaLine?.arguments?.[0]) {
        const schemas = Array.isArray(schemaLine.arguments[0]) ? schemaLine.arguments[0] : [schemaLine.arguments[0]];
        ifcVersion = schemas.map((s: any) => unwrap(s) ?? s).join(', ');
      }
    } catch (e) {
      console.warn('[ModelChecker] GetHeaderLine fallback fehlgeschlagen:', e);
    }
  }

  // 2. Räume (IfcSpace) prüfen
  let spaceCount = 0;
  let unnamedSpaceCount = 0;
  try {
    console.log('[ModelChecker] WebIFC.IFCSPACE =', WebIFC.IFCSPACE);
    const spaceIDsRaw = await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCSPACE);
    console.log('[ModelChecker] IFCSPACE raw result:', spaceIDsRaw, 'type:', typeof spaceIDsRaw, 'constructor:', spaceIDsRaw?.constructor?.name);
    const spaceIDs = toIterable(spaceIDsRaw);
    console.log('[ModelChecker] IFCSPACE IDs:', spaceIDs, 'count:', spaceIDs.length);
    spaceCount = spaceIDs.length;
    for (const sid of spaceIDs) {
      const space = await ifcAPI.GetLine(modelID, sid);
      const name = unwrap(space.Name);
      if (!name || name === '' || name === '$') {
        unnamedSpaceCount++;
      }
    }
  } catch (e) {
    console.warn('[ModelChecker] Fehler bei IfcSpace-Check:', e);
  }

  // 3. Material-Check
  // Zuerst: Material-Zuordnungen einmal einlesen (IfcRelAssociatesMaterial)
  const elementsWithMaterial = new Set<number>();
  try {
    const assocIDs = toIterable(
      await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL)
    );
    for (const assocID of assocIDs) {
      const assoc = await ifcAPI.GetLine(modelID, assocID);
      if (assoc.RelatedObjects && Array.isArray(assoc.RelatedObjects)) {
        for (const ref of assoc.RelatedObjects) {
          const eid = unwrap(ref);
          if (eid !== undefined) elementsWithMaterial.add(eid);
        }
      }
    }
  } catch (e) {
    console.warn('[ModelChecker] Fehler beim Lesen der Materialzuordnungen:', e);
  }

  const typesToCheck: Array<{ typeConst: number; label: string }> = [
    { typeConst: WebIFC.IFCWALL, label: 'IfcWall' },
    { typeConst: WebIFC.IFCSLAB, label: 'IfcSlab' },
    { typeConst: WebIFC.IFCROOF, label: 'IfcRoof' },
    { typeConst: WebIFC.IFCWINDOW, label: 'IfcWindow' },
    { typeConst: WebIFC.IFCDOOR, label: 'IfcDoor' },
  ];

  // Auch IFCWALLSTANDARDCASE als Wall zählen
  if (WebIFC.IFCWALLSTANDARDCASE) {
    typesToCheck.push({ typeConst: WebIFC.IFCWALLSTANDARDCASE, label: 'IfcWall' });
  }

  const materialCheckMap = new Map<string, MaterialCheckEntry>();

  for (const { typeConst, label } of typesToCheck) {
    try {
      const ids = toIterable(await ifcAPI.GetLineIDsWithType(modelID, typeConst));
      const existing = materialCheckMap.get(label) ?? {
        elementType: label,
        total: 0,
        withMaterial: 0,
        withoutMaterial: 0,
        idsWithoutMaterial: [],
      };

      for (const eid of ids) {
        existing.total++;
        if (elementsWithMaterial.has(eid)) {
          existing.withMaterial++;
        } else {
          existing.withoutMaterial++;
          existing.idsWithoutMaterial.push(eid);
        }
      }

      materialCheckMap.set(label, existing);
    } catch (e) {
      console.warn(`[ModelChecker] Fehler bei Typ ${label}:`, e);
    }
  }

  return {
    ifcVersion,
    creationDate,
    projectName,
    spacesExist: spaceCount > 0,
    spaceCount,
    unnamedSpaceCount,
    materialChecks: Array.from(materialCheckMap.values()),
  };
}

// ─── DIN 277 Flächenauswertung ───────────────────────────────────────────────

/**
 * Liest Property-Set-Werte für ein gegebenes Element.
 * Gibt Key-Value-Paare aus allen zugehörigen PropertySets zurück.
 */
async function getPropertyValues(
  ifcAPI: any,
  modelID: number,
  expressID: number,
  relDefIDs: number[]
): Promise<Record<string, any>> {
  const props: Record<string, any> = {};

  for (const relID of relDefIDs) {
    try {
      const rel = await ifcAPI.GetLine(modelID, relID);
      if (!rel.RelatedObjects || !Array.isArray(rel.RelatedObjects)) continue;

      const relatedIds = rel.RelatedObjects.map((ref: any) => unwrap(ref));
      if (!relatedIds.includes(expressID)) continue;

      const propSetID = unwrap(rel.RelatingPropertyDefinition);
      if (!propSetID) continue;

      const propSet = await ifcAPI.GetLine(modelID, propSetID);

      // Für IfcPropertySet (HasProperties)
      if (propSet.HasProperties && Array.isArray(propSet.HasProperties)) {
        for (const pRef of propSet.HasProperties) {
          try {
            const p = await ifcAPI.GetLine(modelID, unwrap(pRef));
            const pName = unwrap(p.Name);
            const pValue = unwrap(p.NominalValue) ?? unwrap(p.value);
            if (pName && pValue !== undefined) {
              props[pName] = pValue;
            }
          } catch { /* skip individual prop */ }
        }
      }

      // Für IfcElementQuantity (Quantities)
      if (propSet.Quantities && Array.isArray(propSet.Quantities)) {
        for (const qRef of propSet.Quantities) {
          try {
            const q = await ifcAPI.GetLine(modelID, unwrap(qRef));
            const qName = unwrap(q.Name);
            const qValue =
              unwrap(q.AreaValue) ??
              unwrap(q.VolumeValue) ??
              unwrap(q.LengthValue) ??
              unwrap(q.value);
            if (qName && qValue !== undefined) {
              const numVal = typeof qValue === 'number' ? qValue : parseFloat(String(qValue));
              if (!isNaN(numVal)) {
                props[qName] = numVal;
              }
            }
          } catch { /* skip individual qty */ }
        }
      }
    } catch { /* skip this rel */ }
  }

  return props;
}

/**
 * Führt die DIN 277 Flächenauswertung durch.
 */
export async function runDin277Analysis(
  ifcAPI: any,
  modelID: number,
  WebIFC: any
): Promise<Din277Result> {
  const spaces: SpaceInfo[] = [];

  // Alle IfcSpace-Entitäten finden
  let spaceIDs: number[] = [];
  try {
    spaceIDs = toIterable(await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCSPACE));
  } catch (e) {
    console.warn('[DIN277] Fehler beim Abrufen von IfcSpace:', e);
    return { spaces: [], summary: { bgf: 0, nrf: 0, nuf: 0, tf: 0, vf: 0 } };
  }

  if (spaceIDs.length === 0) {
    return { spaces: [], summary: { bgf: 0, nrf: 0, nuf: 0, tf: 0, vf: 0 } };
  }

  // Lade alle relevanten Relationen einmal
  let relDefByPropsIDs: number[] = [];
  try {
    relDefByPropsIDs = toIterable(
      await ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES)
    );
  } catch { /* ignore */ }

  // Auch Quantities-Relationen einbeziehen (evtl. separate IDs)
  // IFCRELDEFINESBYPROPERTIES deckt beides ab (PropertySet + ElementQuantity)

  for (const sid of spaceIDs) {
    try {
      const space = await ifcAPI.GetLine(modelID, sid);
      const name = unwrap(space.Name) || null;
      const longName = unwrap(space.LongName) || null;

      // Lese Properties und Quantities
      const allProps = await getPropertyValues(ifcAPI, modelID, sid, relDefByPropsIDs);

      // Versuche Flächen- und Volumenwerte zu extrahieren
      // Verschiedene mögliche Property-Namen (DE/EN/Pset/Qto)
      let netFloorArea: number | null = null;
      let grossFloorArea: number | null = null;
      let volume: number | null = null;

      // NetFloorArea
      const netKeys = ['NetFloorArea', 'NetArea', 'Nettofläche', 'NGA', 'Area'];
      for (const k of netKeys) {
        if (allProps[k] !== undefined) {
          netFloorArea = typeof allProps[k] === 'number' ? allProps[k] : parseFloat(String(allProps[k]));
          if (isNaN(netFloorArea)) netFloorArea = null;
          break;
        }
      }

      // GrossFloorArea
      const grossKeys = ['GrossFloorArea', 'GrossArea', 'Bruttofläche', 'BGA'];
      for (const k of grossKeys) {
        if (allProps[k] !== undefined) {
          grossFloorArea = typeof allProps[k] === 'number' ? allProps[k] : parseFloat(String(allProps[k]));
          if (isNaN(grossFloorArea)) grossFloorArea = null;
          break;
        }
      }

      // Volume
      const volKeys = ['GrossVolume', 'NetVolume', 'Volume', 'Volumen'];
      for (const k of volKeys) {
        if (allProps[k] !== undefined) {
          volume = typeof allProps[k] === 'number' ? allProps[k] : parseFloat(String(allProps[k]));
          if (isNaN(volume)) volume = null;
          break;
        }
      }

      const din277Category = classifySpace(name, longName);

      spaces.push({
        expressID: sid,
        name,
        longName,
        netFloorArea,
        grossFloorArea,
        volume,
        din277Category,
      });
    } catch (e) {
      console.warn(`[DIN277] Fehler bei Space ${sid}:`, e);
    }
  }

  // Aggregation
  const summary: Din277Summary = { bgf: 0, nrf: 0, nuf: 0, tf: 0, vf: 0 };

  for (const s of spaces) {
    const area = s.netFloorArea ?? s.grossFloorArea ?? 0;
    const grossArea = s.grossFloorArea ?? 0;

    summary.bgf += grossArea;

    switch (s.din277Category) {
      case 'NUF':
        summary.nuf += area;
        break;
      case 'VF':
        summary.vf += area;
        break;
      case 'TF':
        summary.tf += area;
        break;
    }
  }

  summary.nrf = summary.nuf + summary.tf + summary.vf;

  return { spaces, summary };
}

// ─── Gesamtanalyse ──────────────────────────────────────────────────────────

/**
 * Führt alle Modellprüfungen und die DIN 277 Auswertung durch.
 */
export async function runFullAnalysis(
  ifcAPI: any,
  modelID: number,
  WebIFC: any,
  rawData?: Uint8Array
): Promise<FullModelAnalysis> {
  const [modelCheck, din277] = await Promise.all([
    runModelChecks(ifcAPI, modelID, WebIFC, rawData),
    runDin277Analysis(ifcAPI, modelID, WebIFC),
  ]);

  // DIN 276 Mengenauswertung: uses parsed elements from toCompactModel
  let din276: Din276QuantityResult | null = null;
  try {
    // Setze modelID, damit toCompactModel korrekt arbeitet
    try { (ifcAPI as any).modelID = modelID; } catch { /* ignore */ }
    const compactModel = await toCompactModel(ifcAPI, modelID, WebIFC);
    const enrichedElements = assignDIN276CostGroups(compactModel.elements);
    din276 = calculateDIN276Quantities(enrichedElements);
    console.log('[DIN276] Zuordnung abgeschlossen:', din276.groups.length, 'Kostengruppen');
  } catch (err) {
    console.warn('[DIN276] Fehler bei der Mengenauswertung:', err);
  }

  return { modelCheck, din277, din276 };
}
