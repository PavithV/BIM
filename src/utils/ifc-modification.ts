
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
