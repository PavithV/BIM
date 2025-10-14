export const analysisData = {
  summary: "The building's sustainability profile shows moderate performance. The global warming potential (GWP) is higher than average for a building of this size, primarily due to the choice of concrete in the structural elements. The non-renewable primary energy (PEnr) consumption is within typical limits. Key areas for improvement are material selection for the facade and optimizing insulation to reduce operational energy use.",
  indicators: [
    { name: 'Global Warming Potential (GWP)', value: '1,250', unit: 'kg CO₂-eq/m²', a: 'A1-A3', rating: 'high' },
    { name: 'Non-renewable Primary Energy (PEnr)', value: '850', unit: 'MJ/m²', a: 'A1-A3', rating: 'medium' },
    { name: 'Recycled Material Usage', value: '15', unit: '%', a: 'A1', rating: 'low' },
  ],
  materialComposition: [
    { name: 'Concrete', value: 45, fill: 'hsl(var(--chart-1))' },
    { name: 'Steel', value: 25, fill: 'hsl(var(--chart-2))' },
    { name: 'Glass', value: 15, fill: 'hsl(var(--chart-3))' },
    { name: 'Insulation', value: 10, fill: 'hsl(var(--chart-4))' },
    { name: 'Other', value: 5, fill: 'hsl(var(--chart-5))' },
  ],
};

export type AnalysisData = typeof analysisData;
