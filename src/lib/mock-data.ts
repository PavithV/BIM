export const analysisData = {
  summary: "Das Nachhaltigkeitsprofil des Gebäudes zeigt eine moderate Leistung. Das Erderwärmungspotenzial (GWP) ist höher als der Durchschnitt für ein Gebäude dieser Größe, was hauptsächlich auf die Wahl von Beton in den Strukturelementen zurückzuführen ist. Der Verbrauch von nicht erneuerbarer Primärenergie (PEnr) liegt innerhalb der typischen Grenzen. Wesentliche Verbesserungsbereiche sind die Materialauswahl für die Fassade und die Optimierung der Dämmung zur Reduzierung des Betriebsenergieverbrauchs.",
  indicators: [
    { name: 'Erderwärmungspotenzial (GWP)', value: '1,250', unit: 'kg CO₂-Äq/m²', a: 'A1-A3', rating: 'high' },
    { name: 'Nicht erneuerbare Primärenergie (PEnr)', value: '850', unit: 'MJ/m²', a: 'A1-A3', rating: 'medium' },
    { name: 'Verwendung von recyceltem Material', value: '15', unit: '%', a: 'A1', rating: 'low' },
  ],
  materialComposition: [
    { name: 'Beton', value: 45, fill: 'hsl(var(--chart-1))' },
    { name: 'Stahl', value: 25, fill: 'hsl(var(--chart-2))' },
    { name: 'Glas', value: 15, fill: 'hsl(var(--chart-3))' },
    { name: 'Dämmung', value: 10, fill: 'hsl(var(--chart-4))' },
    { name: 'Andere', value: 5, fill: 'hsl(var(--chart-5))' },
  ],
};

export type AnalysisData = typeof analysisData;
