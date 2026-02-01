/**
 * @fileOverview IFC-Datei Komprimierung (Fixed Version)
 * * Filtert IFC-Dateien gemäß app.py default_config:
 * - Target_Entities: ["IfcWall", "IfcSlab", "IfcWindow", "IfcColumn", "IfcBeam", "IfcCovering", "IfcFooting", "IfcRoof"]
 */

// Konfiguration aus app.py
const TARGET_ENTITIES = [
  "IfcWall", "IfcWallStandardCase", "IfcSlab", "IfcWindow", "IfcColumn", "IfcBeam",
  "IfcCovering", "IfcFooting", "IfcRoof", "IfcDoor", "IfcPlate", "IfcMember",
  "IfcBuildingElementProxy", "IfcStair", "IfcRailing", "IfcRamp"
];
const VOLUME_PROPERTIES = ["NetVolume", "GrossVolume", "Volume"];
const AREA_PROPERTIES = ["NetArea", "GrossArea", "Area"];
const GWP_PROPERTIES = ["GlobalWarmingPotential", "GWP", "CO2", "GWP_A1_A3"];

export type MaterialReplacement = {
  original: string;
  replacement: string | null;
  originalEntry: any | null;
  suggestions?: string[]; // New: List of all suggested material names
};

/**
 * Komprimiert eine IFC-Datei, indem nur relevante Entitäten und Properties extrahiert werden
 * * @param ifcContent - Der Inhalt der IFC-Datei als String
 * * @param replacementMap - Optional: Eine Map von Original-Material zu gewähltem Ersatz-Material
 * @returns Komprimierter CSV-Inhalt
 */
export function compressIfcFile(ifcContent: string, replacementMap?: Record<string, string>): string {
  // Dekodiere Data-URI falls vorhanden
  let text = ifcContent.toString();
  if (text.trim().startsWith('data:')) {
    try {
      const commaIndex = text.indexOf(',');
      if (commaIndex !== -1) {
        const b64 = text.slice(commaIndex + 1);
        if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } else {
          const Buffer = require('buffer').Buffer;
          const buffer = Buffer.from(b64, 'base64');
          text = buffer.toString('utf-8');
        }
      }
    } catch (e) {
      console.warn('compressIfcFile: failed to decode data URI:', e);
    }
  }

  // Versuche JSON-Parsing (kompaktes Modell von ifcParser)
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.elements)) {
        return processCompactModel(parsed.elements, replacementMap);
      }
    }
  } catch (e) {
    // Kein JSON, fahre mit IFC-Text-Parsing fort
  }

  // Fallback: Parse IFC-Text direkt
  if (text.includes('ISO-10303-21') || text.includes('DATA;') || /#\d+=IFC/i.test(text)) {
    return processIfcText(text, replacementMap);
  }

  console.warn('compressIfcFile: input format not recognized, returning original content');
  return ifcContent;
}

/**
 * Scannt die IFC-Datei nach Materialien und schlägt Ersetzungen vor.
 */
export function getProposedMaterialReplacements(ifcContent: string): MaterialReplacement[] {
  // 1. Parse IFC analog zu compressIfcFile, aber stoppe nach Material-Extraktion
  // Wir nutzen hier eine vereinfachte Logik, die vorhandenen Funktionen wiederverwendet.
  // Da die existierenden Funktionen (processCompactModel / processIfcText) Strings zurückgeben,
  // kopieren wir die relevante Logik oder passen sie an.
  // Effizienter: Wir nutzen die Hauptfunktionen, aber fangen die Matches ab.
  // Wir bauen eine Hilfsfunktion `extractMaterialsAndMatches` die von beiden genutzt werden kann.

  // Dekodiere Data-URI falls nötig (Duplizierter Code, könnte ausgelagert werden)
  let text = ifcContent.toString();
  if (text.trim().startsWith('data:')) {
    try {
      const commaIndex = text.indexOf(',');
      if (commaIndex !== -1) {
        const b64 = text.slice(commaIndex + 1);
        if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } else {
          const Buffer = require('buffer').Buffer;
          const buffer = Buffer.from(b64, 'base64');
          text = buffer.toString('utf-8');
        }
      }
    } catch (e) { }
  }

  const uniqueMaterials = new Set<string>();

  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.elements)) {
        // Compact Model Logic
        const relevantElements = parsed.elements.filter((el: any) => {
          if (!el.type) return false;
          const typeName = el.type.replace(/^IFC/i, '');
          return TARGET_ENTITIES.some(target =>
            typeName.toLowerCase() === target.toLowerCase().replace(/^ifc/i, '')
          );
        });

        for (const el of relevantElements) {
          // Fake volume/area, we just need materials
          const materialEntries = getLayerMaterials(el, 1, 1);
          for (const m of materialEntries) uniqueMaterials.add(m.Material);
        }
      }
    } else {
      // Text Parsing Logic
      // HIER COPY/PASTE der relevanten Instanz-Parsing Schritte um Materialien zu finden
      // Oder wir rufen eine modifizierte processIfcText auf, die ReturnType ändert?
      // Einfacher: Wir führen parsing aus und sammeln Materialien.
      // Achtung: Performance.
      if (text.includes('ISO-10303-21') || text.includes('DATA;') || /#\d+=IFC/i.test(text)) {
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          .split('\n').map((line: string) => line.split(/\/\*/)[0].trim()).join('\n');

        const instances = parseIfcInstances(normalizedText);
        const materials = parseMaterials(instances);
        const materialLayers = parseMaterialLayers(instances);
        const materialLayerSets = parseMaterialLayerSets(instances);
        const materialLayerSetUsages = parseMaterialLayerSetUsages(instances);
        const materialLists = parseMaterialLists(instances);
        const materialRelations = parseMaterialRelationsFromInstances(instances);

        // New: Constituent parsing for proposed replacements
        const materialConstituents = parseMaterialConstituents(instances);
        const materialConstituentSets = parseMaterialConstituentSets(instances);

        const relevantTypes = TARGET_ENTITIES.map(e => e.toUpperCase().replace(/^IFC/, ''));

        for (const [id, instance] of instances.entries()) {
          const typeUpper = instance.type.toUpperCase();
          if (!relevantTypes.some(t => { const typeWithoutIfc = typeUpper.replace(/^IFC/, ''); return typeWithoutIfc === t || typeUpper === `IFC${t}`; })) continue;

          const elementMaterialRelations = materialRelations.filter(r => r.elementId === id);
          const materialEntries = getLayerMaterialsFromIfcText(
            id, instance, elementMaterialRelations, materials, materialLayers,
            materialLayerSets, materialLayerSetUsages, materialLists,
            materialConstituents, materialConstituentSets,
            1, 1
          );
          for (const m of materialEntries) uniqueMaterials.add(m.Material);
        }
      }

    }
  } catch (e) {
    console.warn('getProposedMaterialReplacements: parsing failed', e);
  }

  const db = loadDatabase();
  const replacements: MaterialReplacement[] = [];

  // Sort materials alphabetically for consistent UI
  const sortedMaterials = Array.from(uniqueMaterials).sort();

  for (const matName of sortedMaterials) {
    // OLD: const matched = matchMaterial(matName, db);
    // NEW: Find ALL matches
    const allMatches = matchMaterials(matName, db);

    // Sort matches by relevance? 
    // For now, matchMaterials implementation will handle some order or we sort by simple logic (e.g. length diff) 
    // matchMaterials already does a search. 
    // Let's refine matchMaterials to return an array.

    if (allMatches.length > 0) {
      // Best match is the first one (or logic to pick best)
      const bestMatch = allMatches[0];

      // Only suggest if the best match is different OR if we have multiple options
      // Actually, we only care if we found something in the DB.
      // The original logic was: if (matched && matched.Name !== matName)
      // Meaning if the material is ALREADY correctly named in DB, we don't suggest replacement?
      // But what if user wants to change "Beton" to "Stahlbeton"?
      // Typically "Beton" (IFC) might match "Beton C25/30" (DB).

      // If exact match exists, we might not need replacement, BUT if there are other similar ones?
      // Let's keep the existing logic: Suggest if name differs.

      if (bestMatch.Name !== matName || allMatches.length > 1) {
        replacements.push({
          original: matName,
          replacement: bestMatch.Name,
          originalEntry: bestMatch,
          suggestions: allMatches.map(m => m.Name)
        });
      }
    }
  }

  return replacements;
}

/**
 * Verarbeitet kompaktes JSON-Modell (von ifcParser)
 */
function processCompactModel(elements: any[], replacementMap?: Record<string, string>): string {
  const db = loadDatabase();

  const relevantElements = elements.filter(el => {
    if (!el.type) return false;
    const typeName = el.type.replace(/^IFC/i, '');
    return TARGET_ENTITIES.some(target =>
      typeName.toLowerCase() === target.toLowerCase().replace(/^ifc/i, '')
    );
  });

  const rows: Array<{ Typ: string; Material: string; Volumen_m3: number; Flaeche_m2: number; Total_CO2: number; Total_Cost: number }> = [];

  for (const el of relevantElements) {
    try {
      const type = (el.type || '').replace(/^IFC/i, '');

      // Volumen
      let volume = 0;
      if (el.quantities) {
        for (const prop of VOLUME_PROPERTIES) {
          const val = el.quantities[prop] || el.quantities[prop.toLowerCase()] || el.quantities[prop.toUpperCase()];
          if (val != null) {
            volume = Number(val);
            if (!isNaN(volume)) break;
          }
        }
      }

      // Fläche
      let area = 0;
      if (el.quantities) {
        for (const prop of AREA_PROPERTIES) {
          const val = el.quantities[prop] || el.quantities[prop.toLowerCase()] || el.quantities[prop.toUpperCase()];
          if (val != null) {
            area = Number(val);
            if (!isNaN(area)) break;
          }
        }
      }

      // GWP
      let ifc_gwp: number | null = null;
      if (el.properties && typeof el.properties === 'object') {
        for (const prop of GWP_PROPERTIES) {
          const val = el.properties[prop] || el.properties[prop.toLowerCase()] || el.properties[prop.toUpperCase()];
          if (val != null) {
            const numVal = Number(val);
            if (!isNaN(numVal)) {
              ifc_gwp = numVal;
              break;
            }
          }
        }
      }

      const materialEntries = getLayerMaterials(el, volume, area);

      for (const matEntry of materialEntries) {
        const material = matEntry.Material;
        const matVolume = matEntry.Volumen;
        const matArea = matEntry.Flaeche;

        const matched = matchMaterial(material, db);
        let finalMaterial = material;
        let pData = matched;

        // Custom Replacement Logic
        if (replacementMap && replacementMap.hasOwnProperty(material)) {
          // Wenn User Entscheidung getroffen hat
          const userReplacement = replacementMap[material];
          if (userReplacement) {
            // User will Ersatz -> wir müssen den DB Eintrag dazu finden um korrekte Werte zu haben
            // Da wir nur Namen haben, suchen wir im bereits geladenen Match oder DB?
            // Wenn der User den Vorschlag akzeptiert hat, ist userReplacement == matched.Name
            finalMaterial = userReplacement;
            // Falls der User was anderes gewählt hätte (aktuell nur checkbox an/aus),
            // müssten wir neu suchen. Hier reicht: Wenn finalMaterial == matched.Name, nimm matched.
            // Wenn nicht (theoretisch Custom), nimm matched nicht.
            // Da wir nur Checkbox haben: Enable -> replacementMap[mat] = matched.Name.
            if (matched && userReplacement !== matched.Name) {
              // Sollte im aktuellen UI Konzept nicht passieren
              console.warn(`User replacement ${userReplacement} differs from auto-match ${matched.Name}`);
            }
          } else {
            // User will keinen Ersatz (explizit null/leer) -> Original behalten
            finalMaterial = material;
            pData = undefined; // Keine DB Reference, also keine Kosten/GWP (außer IFC GWP)
          }
        } else {
          // Default Verhalten (Retro-Compatibility / No Map provided): Auto-Replace
          // Aber im neuen Flow wird map provided sein.
          // Wenn map undefined ist -> Auto Replace wie bisher
          if (matched) {
            if (!replacementMap) { // Nur loggen wenn kein explizites Handling
              if (matched.Name !== material) {
                console.log(`Material ersetzt (Auto): "${material}" -> "${matched.Name}"`);
              }
            }
            // Wenn replacementMap existiert aber Key fehlt -> Default: Replacement oder Original?
            // Plan: Wenn map da ist, gelten nur Einträge in Map? Oder Map sind OVERRIDES?
            // Sicherer: Wenn Map da ist, dann ist sie vollständig für alle replacements.
            // Wenn ein Material nicht in Map ist, heißt das "Kein Replacement möglich/nötig".

            if (replacementMap) {
              // Check if this material HAD a potential match but wasn't in map (means user wasn't asked or ignored)
              // Wir gehen davon aus: Map enthält User Preferenzen.
              // Wenn User "Keep Original" wählt, steht key: "" oder key: null drin?
              // Implementation Plan sagt: Checkboxen.
              // Wenn wir replacementMap übergeben, nutzen wir NUR diese Entscheidungen.
              // Wenn key nicht existiert -> Original behalten.
              finalMaterial = material;
              // Aber wir wollen evtl trotzdem DB Werte für "Original" finden wenn Name == Name?
              // matchMaterial sucht Fuzzy.
              // Wenn fuzzy match aber user sagt "Nein", dann pData = null?
              // Ja, sicherheitshalber.
              pData = undefined;
            } else {
              finalMaterial = matched.Name;
            }
          }
        }

        // Fix: Wenn kein Replacement Map da ist (alter Flow), nutzen wir pData von oben (matched).
        // Wenn Replacement Map da ist:
        // Case 1: Key in Map -> Value ist Target Name. Wir brauchen DB Daten für Target Name.
        // Case 2: Key nicht in Map -> Original behalten.

        if (replacementMap) {
          if (replacementMap[material]) {
            const targetName = replacementMap[material];
            finalMaterial = targetName;
            // Finde DB entry für Target Name (exakt, da es aus DB kommt)
            // matchMaterial kann auch exakt finden
            if (matched && matched.Name === targetName) {
              pData = matched;
            } else {
              // Fallback suche? Eigentlich sollte matched stimmen wenn map[mat] == matched.Name
              // Wenn wir manuell suchen müssen (performance overhead):
              // pData = matchMaterial(targetName, db); // Würde wieder fuzzy suchen
              // Besser wir vertrauen darauf dass matched korrekt war.
            }
          } else {
            finalMaterial = material;
            pData = undefined;
            // Sonderfall: Wenn Original == In DB exakt? matchMaterial liefert das.
            // Wenn User "Nein" sagt zum Fuzzy Match, dann nehmen wir Original.
            // Hat Original GWP/Kosten? Nur wenn es EXAKT in DB steht? 
            // Aktuell: matchMaterial ist der Weg zur DB.
            // Wenn User Disable drückt, will er wohl die IFC Werte oder 0.
          }
        }

        const gwp_factor = ifc_gwp !== null ? ifc_gwp : (pData ? pData.GWP_Wert : 0);
        const preis = pData ? pData.Preis_pro_m3 : 0;

        const total_co2 = matVolume * gwp_factor;
        const total_cost = matVolume * preis;

        rows.push({
          Typ: type,
          Material: finalMaterial,
          Volumen_m3: matVolume,
          Flaeche_m2: matArea,
          Total_CO2: total_co2,
          Total_Cost: total_cost
        });
      }
    } catch (e) {
      continue;
    }
  }

  return aggregateAndFormat(rows);
}

function getLayerMaterials(element: any, totalVolume: number, totalArea: number): Array<{ Material: string; Volumen: number; Flaeche: number }> {
  const mats: Array<{ Material: string; Volumen: number; Flaeche: number }> = [];

  if (element.materialLayers && Array.isArray(element.materialLayers)) {
    const totalThick = element.materialLayers.reduce((sum: number, layer: any) => {
      return sum + (layer.thickness || 0);
    }, 0);

    if (totalThick > 0 && totalVolume > 0) {
      for (const layer of element.materialLayers) {
        const thickness = layer.thickness || 0;
        const vol = totalVolume * (thickness / totalThick);
        const materialName = layer.material || layer.name || 'Unbekannt';
        mats.push({ Material: materialName, Volumen: vol, Flaeche: totalArea });
      }
      return mats;
    }
  }

  if (element.materialList && Array.isArray(element.materialList)) {
    const count = element.materialList.length;
    for (const mat of element.materialList) {
      const materialName = mat.name || mat.material || 'Unbekannt';
      mats.push({
        Material: materialName,
        Volumen: totalVolume / count,
        Flaeche: totalArea / count
      });
    }
    return mats;
  }

  const material = element.material || 'Nicht definiert';
  mats.push({ Material: material, Volumen: totalVolume, Flaeche: totalArea });
  return mats;
}

/**
 * ==================================================================================
 * CORE IFC PARSING LOGIC (STEP FORMAT)
 * ==================================================================================
 */

function processIfcText(text: string, replacementMap?: Record<string, string>): string {
  // Parse IFC-Instanzen direkt vom Text (Performance & Memory Optimierung)
  const instances = parseIfcInstances(text);

  // Parse Details mit korrigierter Logik (Positionsbasiert)
  const materials = parseMaterials(instances);
  const materialLayers = parseMaterialLayers(instances);
  const materialLayerSets = parseMaterialLayerSets(instances);
  const materialLayerSetUsages = parseMaterialLayerSetUsages(instances);
  const materialLists = parseMaterialLists(instances);

  const quantities = parseQuantities(instances);
  const properties = parseProperties(instances);

  // Relationen (Jetzt korrigiert!)
  const materialRelations = parseMaterialRelationsFromInstances(instances);
  const quantityRelations = parseQuantityRelationsFromInstances(instances);
  const propertyRelations = parsePropertyRelationsFromInstances(instances); // Für GWP in Psets

  // New: Constituent parsing
  const materialConstituents = parseMaterialConstituents(instances);
  const materialConstituentSets = parseMaterialConstituentSets(instances);

  const db = loadDatabase();
  const relevantTypes = TARGET_ENTITIES.map(e => e.toUpperCase().replace(/^IFC/, ''));
  const rows: Array<{ Typ: string; Material: string; Volumen_m3: number; Flaeche_m2: number; Total_CO2: number; Total_Cost: number }> = [];



  // Robust Census:
  const typeCounts = new Map<string, number>();
  for (const [_, inst] of instances) {
    const t = inst.type.toUpperCase();
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  const topTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30) // Top 30 types
    .map(([t, c]) => `${t}:${c}`)
    .join(', ');

  console.log(`compressIfcFile: found ${instances.size} instances. Top Types: ${topTypes}`);

  for (const [id, instance] of instances.entries()) {
    const typeUpper = instance.type.toUpperCase();
    const matches = relevantTypes.some(t => {
      const typeWithoutIfc = typeUpper.replace(/^IFC/, '');
      return typeWithoutIfc === t || typeUpper === `IFC${t}`;
    });
    if (!matches) continue;

    const type = instance.type.replace(/^IFC/i, '');

    // 1. Quantities finden
    let volume = 0;
    let area = 0;

    // Check Relations (RelDefinesByQuantity AND RelDefinesByProperties)
    // Some exporters (Allplan) use RelDefinesByProperties to link ElementQuantity

    const relevantQtyIds: number[] = [];

    // 1. From RelDefinesByQuantity
    const foundQtyRels = quantityRelations.filter(r => r.elementId === id);
    foundQtyRels.forEach(r => relevantQtyIds.push(r.quantityId));

    // 2. From RelDefinesByProperties (Check if PsetID isn't actually a QuantitySetID)
    const propRels = propertyRelations.filter(r => r.elementId === id);
    propRels.forEach(r => {
      if (quantities.has(r.propertySetId)) {
        relevantQtyIds.push(r.propertySetId);
      }
    });

    for (const qId of relevantQtyIds) {
      const qty = quantities.get(qId);
      if (qty) {
        for (const prop of VOLUME_PROPERTIES) if (qty[prop] != null) { volume = qty[prop]; break; }
        for (const prop of AREA_PROPERTIES) if (qty[prop] != null) { area = qty[prop]; break; }
      }
      if (volume > 0 && area > 0) break;
    }

    // 2. GWP finden (via Properties)
    let ifc_gwp: number | null = null;
    const propRel = propertyRelations.find(r => r.elementId === id);
    if (propRel) {
      // Ein Element kann mehrere PropertySets haben, wir vereinfachen hier auf eines oder iterieren
      // Da die Relations Liste flatten ist, suchen wir alle Psets für dieses Element
      const psetIds = propertyRelations.filter(r => r.elementId === id).map(r => r.propertySetId);
      for (const psetId of psetIds) {
        const props = properties.get(psetId);
        if (props) {
          for (const prop of GWP_PROPERTIES) {
            const val = props[prop];
            if (val != null && !isNaN(val)) {
              ifc_gwp = val;
              break;
            }
          }
        }
        if (ifc_gwp !== null) break;
      }
    }

    // 3. Material finden
    // ALLE Relationen für dieses Element finden
    const elementMaterialRelations = materialRelations.filter(r => r.elementId === id);

    const materialEntries = getLayerMaterialsFromIfcText(
      id,
      instance,
      elementMaterialRelations, // Pass ALL relations for this element
      materials,
      materialLayers,
      materialLayerSets,
      materialLayerSetUsages,
      materialLists,
      materialConstituents,
      materialConstituentSets,
      volume,
      area
    );

    // 4. Zeilen generieren
    for (const matEntry of materialEntries) {
      const material = matEntry.Material;
      const matVolume = matEntry.Volumen;
      const matArea = matEntry.Flaeche;

      const matched = matchMaterial(material, db);
      let finalMaterial = material;
      let pData = matched;

      // Copy Paste Logic from processCompactModel for Consistency
      if (replacementMap) {
        if (replacementMap[material]) {
          const targetName = replacementMap[material];
          finalMaterial = targetName;
          if (matched && matched.Name === targetName) {
            pData = matched;
          }
        } else {
          finalMaterial = material;
          pData = undefined;
        }
      } else {
        if (matched) {
          finalMaterial = matched.Name;
          if (matched.Name !== material) {
            console.log(`Material ersetzt (Auto): "${material}" -> "${matched.Name}"`);
          }
        }
      }

      const gwp_factor = ifc_gwp !== null ? ifc_gwp : (pData ? pData.GWP_Wert : 0);
      const preis = pData ? pData.Preis_pro_m3 : 0;

      rows.push({
        Typ: type,
        Material: finalMaterial,
        Volumen_m3: matVolume,
        Flaeche_m2: matArea,
        Total_CO2: matVolume * gwp_factor,
        Total_Cost: matVolume * preis
      });
    }
  }

  return aggregateAndFormat(rows);
}

/**
 * Hilfsfunktion: Splittet Argumente im STEP-Format korrekt (ignoriert Kommas in Strings/Klammern)
 * Bsp: "'Name, Text', (#1, #2), .T." -> ["'Name, Text'", "(#1, #2)", ".T."]
 */
function splitIfcArguments(args: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (let i = 0; i < args.length; i++) {
    const char = args[i];
    if (char === "'" && (i === 0 || args[i - 1] !== '\\')) {
      inQuote = !inQuote;
    }
    if (!inQuote) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
    }

    if (char === ',' && depth === 0 && !inQuote) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current.trim());
  return parts;
}

/**
 * Entfernt Quotes aus IFC Strings ('Text' -> Text)
 */
function cleanIfcString(str: string): string {
  if (!str) return '';
  if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1);
  return str;
}

function parseIfcInstances(text: string): Map<number, { type: string; args: string }> {
  const instances = new Map<number, { type: string; args: string }>();
  let pos = 0;
  while (pos < text.length) {
    const instanceStart = text.indexOf('#', pos);
    if (instanceStart === -1) break;

    const equalsMatch = text.slice(instanceStart).match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/);
    if (!equalsMatch) {
      pos = instanceStart + 1;
      continue;
    }

    const id = parseInt(equalsMatch[1]);
    const type = equalsMatch[2];
    const openParenPos = instanceStart + equalsMatch[0].indexOf('(');

    let depth = 1;
    let currentPos = openParenPos + 1;
    let argsEnd = -1;
    let inQuote = false;

    while (currentPos < text.length && depth > 0) {
      const char = text[currentPos];
      if (char === "'" && text[currentPos - 1] !== '\\') inQuote = !inQuote;
      if (!inQuote) {
        if (char === '(') depth++;
        else if (char === ')') {
          depth--;
          if (depth === 0) {
            argsEnd = currentPos;
            break;
          }
        }
      }
      currentPos++;
    }

    if (argsEnd === -1) {
      pos = instanceStart + 1;
      continue;
    }
    const args = text.slice(openParenPos + 1, argsEnd);
    instances.set(id, { type, args });
    pos = argsEnd + 1;
  }
  return instances;
}

function parseMaterials(instances: Map<number, any>): Map<number, string> {
  const materials = new Map<number, string>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIAL') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIAL(Name, Description, Category);
      // Index 0 = Name
      if (params.length > 0) {
        materials.set(id, cleanIfcString(params[0]));
      }
    }
  }
  return materials;
}

function parseMaterialLayers(instances: Map<number, any>): Map<number, { materialId?: number; thickness?: number }> {
  const layers = new Map<number, { materialId?: number; thickness?: number }>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALLAYER') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALLAYER(Material, Thickness, IsVentilated, ...);
      // Index 0 = Material (Ref)
      // Index 1 = Thickness (Number)

      const layer: { materialId?: number; thickness?: number } = {};

      if (params.length > 0) {
        const matMatch = params[0].match(/#(\d+)/);
        if (matMatch) layer.materialId = parseInt(matMatch[1]);
      }
      if (params.length > 1) {
        const val = parseFloat(params[1]);
        if (!isNaN(val)) layer.thickness = val;
      }
      layers.set(id, layer);
    }
  }
  return layers;
}

function parseMaterialLayerSets(instances: Map<number, any>): Map<number, number[]> {
  const layerSets = new Map<number, number[]>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALLAYERSET') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALLAYERSET(MaterialLayers, LayerSetName);
      // Index 0 = List of Layers
      if (params.length > 0) {
        const layerRefs: number[] = [];
        const matches = Array.from(params[0].matchAll(/#(\d+)/g));
        for (const m of matches) layerRefs.push(parseInt(m[1]));
        if (layerRefs.length > 0) layerSets.set(id, layerRefs);
      }
    }
  }
  return layerSets;
}

function parseMaterialLayerSetUsages(instances: Map<number, any>): Map<number, { layerSetId: number }> {
  const usages = new Map<number, { layerSetId: number }>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALLAYERSETUSAGE') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALLAYERSETUSAGE(ForLayerSet, LayerSetDirection, ...);
      // Index 0 = ForLayerSet (Ref)
      if (params.length > 0) {
        const match = params[0].match(/#(\d+)/);
        if (match) {
          usages.set(id, { layerSetId: parseInt(match[1]) });
        }
      }
    }
  }
  return usages;
}

function parseMaterialLists(instances: Map<number, any>): Map<number, number[]> {
  const lists = new Map<number, number[]>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALLIST') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALLIST(Materials);
      // Index 0 = List of Materials
      if (params.length > 0) {
        const matRefs: number[] = [];
        const matches = Array.from(params[0].matchAll(/#(\d+)/g));
        for (const m of matches) matRefs.push(parseInt(m[1]));
        if (matRefs.length > 0) lists.set(id, matRefs);
      }
    }
  }
  return lists;
}

function parseMaterialConstituents(instances: Map<number, any>): Map<number, { materialId?: number; fraction?: number }> {
  const constituents = new Map<number, { materialId?: number; fraction?: number }>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALCONSTITUENT') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALCONSTITUENT(Name, Description, Material, Fraction, Category);
      // Index 2 = Material (Ref)
      // Index 3 = Fraction (Number)

      const constituent: { materialId?: number; fraction?: number } = {};

      if (params.length > 2) {
        const matMatch = params[2].match(/#(\d+)/);
        if (matMatch) constituent.materialId = parseInt(matMatch[1]);
      }
      if (params.length > 3) {
        const val = parseFloat(params[3]);
        if (!isNaN(val)) constituent.fraction = val;
      }
      constituents.set(id, constituent);
    }
  }
  return constituents;
}

function parseMaterialConstituentSets(instances: Map<number, any>): Map<number, number[]> {
  const sets = new Map<number, number[]>();
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCMATERIALCONSTITUENTSET') {
      const params = splitIfcArguments(instance.args);
      // IFCMATERIALCONSTITUENTSET(Name, Description, MaterialConstituents);
      // Index 2 = List of MaterialConstituents
      if (params.length > 2) {
        const constituentRefs: number[] = [];
        const matches = Array.from(params[2].matchAll(/#(\d+)/g));
        for (const m of matches) constituentRefs.push(parseInt(m[1]));
        if (constituentRefs.length > 0) sets.set(id, constituentRefs);
      }
    }
  }
  return sets;
}

/**
 * FIXED: Material-Relationen über Position finden (Index 4 = Objects, Index 5 = Material)
 */
function parseMaterialRelationsFromInstances(instances: Map<number, { type: string; args: string }>): Array<{ elementId: number; materialId: number }> {
  const relations: Array<{ elementId: number; materialId: number }> = [];

  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() !== 'IFCRELASSOCIATESMATERIAL') continue;

    const params = splitIfcArguments(instance.args);
    // IfcRelAssociatesMaterial(GlobalId, OwnerHistory, Name, Description, RelatedObjects, RelatingMaterial)
    // Index 4: RelatedObjects (Liste)
    // Index 5: RelatingMaterial

    if (params.length < 6) continue;

    const relatedObjectsStr = params[4];
    const relatingMaterialStr = params[5];

    const matMatch = relatingMaterialStr.match(/#(\d+)/);
    if (!matMatch) continue;
    const materialId = parseInt(matMatch[1]);

    const elementMatches = Array.from(relatedObjectsStr.matchAll(/#(\d+)/g));
    for (const elemMatch of elementMatches) {
      const elementId = parseInt((elemMatch as RegExpMatchArray)[1]);
      relations.push({ elementId, materialId });
    }
  }
  return relations;
}

/**
 * FIXED: Quantity-Relationen (RelDefinesByQuantity)
 */
function parseQuantityRelationsFromInstances(instances: Map<number, { type: string; args: string }>): Array<{ elementId: number; quantityId: number }> {
  const relations: Array<{ elementId: number; quantityId: number }> = [];
  let debugCount = 0;

  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() !== 'IFCRELDEFINESBYQUANTITY') continue;

    const params = splitIfcArguments(instance.args);

    // Debug first few instances
    if (debugCount < 3) {
      console.log(`[DEBUG] IFCRELDEFINESBYQUANTITY #${id}: params.length=${params.length}`);
      console.log(`[DEBUG] Args raw: ${instance.args}`);
      console.log(`[DEBUG] Parsed Params:`, params);
      debugCount++;
    }

    // IfcRelDefinesByQuantity(GlobalId, OwnerHistory, Name, Description, RelatedObjects, RelatingQuantity)
    // Index 4: RelatedObjects
    // Index 5: RelatingQuantity (QuantitySet)

    if (params.length < 6) {
      if (debugCount < 5) console.log(`[DEBUG] Skipped #${id} - params < 6`);
      continue;
    }

    const qMatch = params[5].match(/#(\d+)/);
    if (!qMatch) {
      if (debugCount < 5) console.log(`[DEBUG] Skipped #${id} - no RelatingQuantity match in ${params[5]}`);
      continue;
    }
    const quantitySetId = parseInt(qMatch[1]);

    const relatedObjectsStr = params[4];
    const elementMatches = Array.from(relatedObjectsStr.matchAll(/#(\d+)/g));

    if (elementMatches.length === 0 && debugCount < 5) {
      console.log(`[DEBUG] Skipped #${id} - no RelatedObjects found in ${relatedObjectsStr}`);
    }

    for (const elemMatch of elementMatches) {
      relations.push({ elementId: parseInt(elemMatch[1]), quantityId: quantitySetId });
    }
  }
  return relations;
}

/**
 * NEW: Property-Relationen (RelDefinesByProperties) für GWP
 */
function parsePropertyRelationsFromInstances(instances: Map<number, { type: string; args: string }>): Array<{ elementId: number; propertySetId: number }> {
  const relations: Array<{ elementId: number; propertySetId: number }> = [];

  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() !== 'IFCRELDEFINESBYPROPERTIES') continue;

    const params = splitIfcArguments(instance.args);
    // Index 4: RelatedObjects
    // Index 5: RelatingPropertyDefinition

    if (params.length < 6) continue;

    const pMatch = params[5].match(/#(\d+)/);
    if (!pMatch) continue;
    const psetId = parseInt(pMatch[1]);

    const elementMatches = Array.from(params[4].matchAll(/#(\d+)/g));
    for (const elemMatch of elementMatches) {
      relations.push({ elementId: parseInt(elemMatch[1]), propertySetId: psetId });
    }
  }
  return relations;
}

/**
 * FIXED: Quantities extrahieren (IfcQuantityVolume, IfcElementQuantity)
 */
function parseQuantities(instances: Map<number, any>): Map<number, Record<string, number>> {
  const quantities = new Map<number, Record<string, number>>();

  // Schritt 1: Einzelne Quantities finden
  // IfcQuantityVolume(Name, Description, Unit, VolumeValue)
  const singleQtys = new Map<number, { name: string, val: number }>();

  for (const [id, instance] of instances.entries()) {
    const type = instance.type.toUpperCase();
    if (type === 'IFCQUANTITYVOLUME' || type === 'IFCQUANTITYAREA') {
      const params = splitIfcArguments(instance.args);
      // Index 0: Name
      // Index 3: Value
      if (params.length >= 4) {
        const name = cleanIfcString(params[0]);
        const valStr = params[3];
        // Value kann z.B. 25.0 oder IfcVolumeMeasure(25.0) sein
        const valMatch = valStr.match(/([0-9]+\.[0-9]+(?:[Ee][+-]?[0-9]+)?|[0-9]+)/);
        if (valMatch) {
          singleQtys.set(id, { name: name, val: parseFloat(valMatch[0]) });
        }
      }
    }
  }

  // Schritt 2: QuantitySets (IfcElementQuantity) auslesen
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCELEMENTQUANTITY') {
      const params = splitIfcArguments(instance.args);
      // IfcElementQuantity(GlobalId, ..., Quantities)
      // Index 5: Quantities (Liste von Refs)
      if (params.length >= 6) {
        const qty: Record<string, number> = {};
        const refs = Array.from(params[5].matchAll(/#(\d+)/g));
        for (const r of refs) {
          const refId = parseInt(r[1]);
          const qData = singleQtys.get(refId);
          if (qData) {
            // Mapping
            const n = qData.name.toUpperCase();
            if (n.includes('NETVOLUME')) qty['NetVolume'] = qData.val;
            else if (n.includes('GROSSVOLUME')) qty['GrossVolume'] = qData.val;
            else if (n.includes('NETAREA')) qty['NetArea'] = qData.val;
            else if (n.includes('GROSSAREA')) qty['GrossArea'] = qData.val;
            else if (n.includes('AREA')) qty['Area'] = qData.val;
            else if (n.includes('VOLUME')) qty['NetVolume'] = qData.val; // Fallback
          }
        }
        if (Object.keys(qty).length > 0) quantities.set(id, qty);
      }
    }
  }

  return quantities;
}

/**
 * FIXED: Properties (GWP) extrahieren
 */
function parseProperties(instances: Map<number, any>): Map<number, Record<string, number>> {
  const properties = new Map<number, Record<string, number>>();

  // Schritt 1: Einzelne Properties (IfcPropertySingleValue)
  const singleProps = new Map<number, { name: string, val: number }>();

  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCPROPERTYSINGLEVALUE') {
      const params = splitIfcArguments(instance.args);
      // IfcPropertySingleValue(Name, Description, NominalValue, Unit)
      // Index 0: Name
      // Index 2: NominalValue
      if (params.length >= 3) {
        const name = cleanIfcString(params[0]);
        // Prüfen ob relevanter Name
        if (GWP_PROPERTIES.some(p => name.toUpperCase().includes(p.toUpperCase()))) {
          const valStr = params[2];
          const valMatch = valStr.match(/([0-9]+\.[0-9]+(?:[Ee][+-]?[0-9]+)?|[0-9]+)/);
          if (valMatch) {
            singleProps.set(id, { name: name, val: parseFloat(valMatch[0]) });
          }
        }
      }
    }
  }

  // Schritt 2: PropertySets (IfcPropertySet)
  for (const [id, instance] of instances.entries()) {
    if (instance.type.toUpperCase() === 'IFCPROPERTYSET') {
      const params = splitIfcArguments(instance.args);
      // IfcPropertySet(..., HasProperties)
      // Index 4: HasProperties (Liste)
      if (params.length >= 5) {
        const props: Record<string, number> = {};
        const refs = Array.from(params[4].matchAll(/#(\d+)/g));
        for (const r of refs) {
          const refId = parseInt(r[1]);
          const pData = singleProps.get(refId);
          if (pData) {
            // Einfügen unter dem gefundenen Namen
            // Wir mappen es auf den ersten passenden GWP Key
            for (const gwpKey of GWP_PROPERTIES) {
              if (pData.name.toUpperCase().includes(gwpKey.toUpperCase())) {
                props[gwpKey] = pData.val;
              }
            }
          }
        }
        if (Object.keys(props).length > 0) properties.set(id, props);
      }
    }
  }

  return properties;
}

function getLayerMaterialsFromIfcText(
  elementId: number,
  instance: any,
  elementMaterialRelations: Array<{ elementId: number; materialId: number }>,
  materials: Map<number, string>,
  materialLayers: Map<number, { materialId?: number; thickness?: number }>,
  materialLayerSets: Map<number, number[]>,
  materialLayerSetUsages: Map<number, { layerSetId: number }>,
  materialLists: Map<number, number[]>,
  materialConstituents: Map<number, { materialId?: number; fraction?: number }>,
  materialConstituentSets: Map<number, number[]>,
  totalVolume: number,
  totalArea: number
): Array<{ Material: string; Volumen: number; Flaeche: number }> {

  if (!elementMaterialRelations || elementMaterialRelations.length === 0) {
    return [{ Material: 'Nicht definiert', Volumen: totalVolume, Flaeche: totalArea }];
  }

  // Priorisierung: 
  // 1. ConstituentSet (Fractions)
  // 2. LayerSetUsage / LayerSet (Thickness)
  // 3. MaterialList (Avg)
  // 4. Einzelnes Material (100%)

  let bestMatch: Array<{ Material: string; Volumen: number; Flaeche: number }> | null = null;
  let bestPriority = -1;

  const safeTotalVol = totalVolume > 0 ? totalVolume : 0; // Use 0 if total is 0, logic still holds

  for (const rel of elementMaterialRelations) {
    const materialId = rel.materialId;

    // --- CHECK PRIORITY 3: ConstituentSet ---
    const constituentSetIds = materialConstituentSets.get(materialId); // If materialId IS a constituent set
    if (constituentSetIds) {
      // materialId points to IFCMATERIALCONSTITUENTSET
      const constituentIds = networkGetConstituents(materialId, materialConstituentSets);
      // The map values are arrays of IDs
      // Actually materialConstituentSets.get(id) returns number[] (list of constituents)
      // So if materialId IS the Set ID, we get the list directly.

      const cIds = materialConstituentSets.get(materialId);
      if (cIds && cIds.length > 0) {
        const mats: Array<{ Material: string; Volumen: number; Flaeche: number }> = [];
        let currentVolSum = 0;
        let undefinedCount = 0;

        // First pass: Calculate defined volumes
        for (const cId of cIds) {
          const c = materialConstituents.get(cId);
          if (c && c.fraction !== undefined) {
            currentVolSum += (c.fraction * safeTotalVol);
          } else {
            undefinedCount++;
          }
        }

        // Handle missing fractions: Distribute remaining volume equally
        const remainingVol = Math.max(0, safeTotalVol - currentVolSum);
        const volPerUndefined = undefinedCount > 0 ? remainingVol / undefinedCount : 0;

        for (const cId of cIds) {
          const c = materialConstituents.get(cId);
          if (c) {
            const matName = c.materialId ? (materials.get(c.materialId) || 'Unbekannt') : 'Unbekannt';
            let vol = 0;
            if (c.fraction !== undefined) {
              vol = c.fraction * safeTotalVol;
            } else {
              vol = volPerUndefined;
            }
            mats.push({ Material: matName, Volumen: vol, Flaeche: totalArea }); // Area is tricky for constituents, keeping total
          }
        }

        if (bestPriority < 3) {
          bestMatch = mats;
          bestPriority = 3;
        }
      }
    }

    // --- CHECK PRIORITY 2: LayerSetUsage / LayerSet ---
    // Could be Usage pointing to Set, or Set directly
    let layerSetId: number | undefined = undefined;

    if (materialLayerSetUsages.has(materialId)) {
      layerSetId = materialLayerSetUsages.get(materialId)?.layerSetId;
    } else if (materialLayerSets.has(materialId)) {
      layerSetId = materialId;
    }

    if (layerSetId !== undefined) {
      const layerIds = materialLayerSets.get(layerSetId);
      if (layerIds && layerIds.length > 0) {
        let totalThick = 0;
        const layerData: Array<{ materialId?: number; thickness: number }> = [];

        for (const layerId of layerIds) {
          const layer = materialLayers.get(layerId);
          if (layer && layer.thickness) {
            totalThick += layer.thickness;
            layerData.push({ materialId: layer.materialId, thickness: layer.thickness });
          } else if (layer) {
            // Layer exists but no thickness
            layerData.push({ materialId: layer.materialId, thickness: 0 });
          }
        }

        const mats: Array<{ Material: string; Volumen: number; Flaeche: number }> = [];

        if (totalThick > 0) {
          for (const layer of layerData) {
            const vol = safeTotalVol * (layer.thickness / totalThick);
            const matId = layer.materialId;
            const materialName = matId ? (materials.get(matId) || 'Unbekannt') : 'Unbekannt';
            mats.push({ Material: materialName, Volumen: vol, Flaeche: totalArea });
          }
        } else {
          // Equal distribution if no thickness
          const count = layerData.length;
          const vol = safeTotalVol / count;
          for (const layer of layerData) {
            const matId = layer.materialId;
            const materialName = matId ? (materials.get(matId) || 'Unbekannt') : 'Unbekannt';
            mats.push({ Material: materialName, Volumen: vol, Flaeche: totalArea });
          }
        }

        if (bestPriority < 2) {
          bestMatch = mats;
          bestPriority = 2;
        }
      }
    }

    // --- CHECK PRIORITY 1: MaterialList ---
    if (bestPriority < 1) {
      const materialListIds = materialLists.get(materialId);
      if (materialListIds && materialListIds.length > 0) {
        const count = materialListIds.length;
        const mats: Array<{ Material: string; Volumen: number; Flaeche: number }> = [];
        for (const matId of materialListIds) {
          const materialName = materials.get(matId) || 'Unbekannt';
          mats.push({
            Material: materialName,
            Volumen: safeTotalVol / count,
            Flaeche: totalArea / count
          });
        }
        if (bestPriority < 1) {
          bestMatch = mats;
          bestPriority = 1;
        }
      }
    }

    // --- CHECK PRIORITY 0: Simple Material ---
    if (bestPriority < 0) {
      const material = materials.get(materialId);
      if (material) {
        bestMatch = [{ Material: material, Volumen: safeTotalVol, Flaeche: totalArea }];
        bestPriority = 0;
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // Fallback: Total volume to unknown
  return [{ Material: 'Unbekannt', Volumen: safeTotalVol, Flaeche: totalArea }];
}

// Helper (dummy for now as we access maps directly)
function networkGetConstituents(id: number, map: Map<number, number[]>) { return []; }

/**
 * Datenbank & Matching (Unverändert)
 */
function loadDatabase(): Record<string, { Name: string; GWP_Wert: number; Preis_pro_m3: number }> {
  const defaultNames = [
    'Stahlbeton (C25/30)', 'Mauerziegel', 'Kalksandstein', 'Holz', 'Dämmung', 'Glas', 'Alu', 'Estrich', 'Gipskarton'
  ];
  const defaultGwps = [320.0, 350.0, 210.0, -750.0, 40.0, 2500.0, 18000.0, 350.0, 290.0];
  const defaultPrices = [450.0, 550.0, 480.0, 900.0, 250.0, 5000.0, 15000.0, 200.0, 600.0];

  const db: Record<string, { Name: string; GWP_Wert: number; Preis_pro_m3: number }> = {};
  for (let i = 0; i < defaultNames.length; i++) {
    db[defaultNames[i]] = { Name: defaultNames[i], GWP_Wert: defaultGwps[i], Preis_pro_m3: defaultPrices[i] };
  }

  try {
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      const csvPath = path.join(process.cwd(), 'OBD.csv');
      if (fs.existsSync(csvPath)) {
        const raw = fs.readFileSync(csvPath, 'utf8');
        const lines = raw.split(/\r?\n/).filter((l: string) => l.trim());
        const header = lines[0].split(';').map((h: string) => h.trim());
        const nameIdx = header.findIndex((h: string) => /name/i.test(h));
        const gwpIdx = header.findIndex((h: string) => /gwp/i.test(h));
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(';').map((p: string) => p.trim());
          const name = parts[nameIdx] || parts[0];
          const gwp = gwpIdx >= 0 ? Number(parts[gwpIdx] || 0) : 0;
          if (name) {
            db[name] = { Name: name, GWP_Wert: isNaN(gwp) ? 0 : gwp, Preis_pro_m3: db[name]?.Preis_pro_m3 ?? 0 };
          }
        }
      }
    }
  } catch (e) { }
  return db;
}

function matchMaterial(material: string, db: Record<string, { Name: string; GWP_Wert: number; Preis_pro_m3: number }>): { Name: string; GWP_Wert: number; Preis_pro_m3: number } | undefined {
  const normalize = (s: string) => (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '').trim();
  const normMat = normalize(material);
  const dbEntries = Object.values(db);

  for (const candidate of dbEntries) {
    const candNorm = normalize(candidate.Name);
    if (!candNorm) continue;
    if (candNorm === normMat || normMat.includes(candNorm) || candNorm.includes(normMat) || candNorm.startsWith(normMat) || normMat.startsWith(candNorm)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Findet ALLE passenden Materialien in der DB
 */
function matchMaterials(material: string, db: Record<string, { Name: string; GWP_Wert: number; Preis_pro_m3: number }>): Array<{ Name: string; GWP_Wert: number; Preis_pro_m3: number }> {
  const normalize = (s: string) => (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '').trim();
  const normMat = normalize(material);
  const dbEntries = Object.values(db);
  const matches: Array<{ Name: string; GWP_Wert: number; Preis_pro_m3: number }> = [];

  for (const candidate of dbEntries) {
    const candNorm = normalize(candidate.Name);
    if (!candNorm) continue;

    // Check for match
    if (candNorm === normMat || normMat.includes(candNorm) || candNorm.includes(normMat) || candNorm.startsWith(normMat) || normMat.startsWith(candNorm)) {
      matches.push(candidate);
    }
  }

  // Sort matches? 
  // Prefer exact matches or shorter diffs?
  // Let's sort by length of name (assuming closer match is better? or longer name is more specific?)
  // Let's sort so that "Beton" matches "Beton C25" better than "Beton C25/30"? Maybe not.
  // Let's just default to DB order unless we have a smart score.
  // Actually, usually "Stahlbeton" is better than "Beton".

  return matches;
}

function aggregateAndFormat(rows: Array<{ Typ: string; Material: string; Volumen_m3: number; Flaeche_m2: number; Total_CO2: number; Total_Cost: number }>): string {
  const aggMap: Record<string, { Typ: string; Material: string; Volumen_m3: number; Flaeche_m2: number; Total_CO2: number; Total_Cost: number }> = {};

  for (const r of rows) {
    const key = `${r.Typ}||${r.Material}`;
    if (!aggMap[key]) {
      aggMap[key] = { ...r };
    } else {
      aggMap[key].Volumen_m3 += r.Volumen_m3;
      aggMap[key].Flaeche_m2 += r.Flaeche_m2;
      aggMap[key].Total_CO2 += r.Total_CO2;
      aggMap[key].Total_Cost += r.Total_Cost;
    }
  }

  const outRows = [['Typ', 'Material', 'Volumen_m3', 'Flaeche_m2', 'Total_CO2', 'Total_Cost']];
  for (const key of Object.keys(aggMap)) {
    const v = aggMap[key];
    outRows.push([v.Typ, v.Material, String(v.Volumen_m3), String(v.Flaeche_m2), String(v.Total_CO2), String(v.Total_Cost)]);
  }

  return outRows.map(r => r.join(';')).join('\n');
}

/**
 * Wendet Material-Ersetzungen auf den IFC-Inhalt an und gibt den aktualisierten Dateiinhalt zurück.
 * @param ifcContent Original IFC-String
 * @param replacementMap Map von Original -> Neu
 */
export function applyReplacementsToIfc(ifcContent: string, replacementMap: Record<string, string>): string {
  // 1. Parsing vorbereiten um Positionen zu finden
  // Wir nutzen die bestehende parseIfcInstances Logik, aber wir müssen wissen WO im String die Namen stehen.
  // Das aktuelle parseIfcInstances gibt nur Values zurück, keine Positionen.
  // Lösung: Wir machen eine einfache Regex-Ersetzung, ABER wir müssen vorsichtig sein, dass wir nur Materialnamen ersetzen.
  // Glücklicherweise sind IFCMATERIAL Instanzen eindeutig: IFCMATERIAL('Name', ...);

  let newContent = ifcContent;

  // Sortiere Keys nach Länge absteigend, um Teilstring-Probleme zu vermeiden
  const sortedKeys = Object.keys(replacementMap).sort((a, b) => b.length - a.length);

  for (const originalName of sortedKeys) {
    const newName = replacementMap[originalName];
    if (!newName || newName === originalName) continue;

    // Wir suchen nach IFCMATERIAL('OriginalName'...)
    // Regex muss flexibel sein für Whitespace
    // IFC Strings sind in Single Quotes '...'.
    // Achtung: UTF-8 Encoding in IFC kann komplex sein (\X2\...), aber wir nehmen an es ist decoded oder simple ASCII.
    // Wir ersetzen NUR in IFCMATERIAL Definitionen.

    // Pattern: IFCMATERIAL\s*\(\s*'OriginalName'
    // Escape special regex chars in originalName
    const escapedOriginal = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Wir bauen eine Regex, die IFCMATERIAL Instanzen findet und den Namen capturet
    // Wir ersetzen global + case insensitive (IFC ist case insensitive oft) aber Materialnamen oft case sensitive?
    // Sicherer: Case Insensitive für 'IFCMATERIAL', aber Case Sensitive für den Namen (oder auch insensitive wenn DB fuzzy matcht?)
    // Da wir replaceMap haben, nutzen wir exakten Match vom OriginalKey.

    const regex = new RegExp(`(IFCMATERIAL\\s*\\(\\s*')(${escapedOriginal})(')`, 'gi');

    newContent = newContent.replace(regex, (match, prefix, name, suffix) => {
      // replace name with newName
      return `${prefix}${newName}${suffix}`;
    });
  }

  return newContent;
}