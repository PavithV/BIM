'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, X, Download, FileText, Sparkles, Building, MapPin, Calendar, Info, ShieldCheck } from 'lucide-react';
import type { EnergyPassData, EnergyEfficiencyClass } from '@/lib/types';
import { tr, type Language } from '@/lib/i18n';

interface EnergyPassPdfPreviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  data: EnergyPassData;
}

const EFFICIENCY_CLASSES: { label: EnergyEfficiencyClass; color: string; maxKwh: number }[] = [
  { label: 'A+', color: '#00845a', maxKwh: 30 },
  { label: 'A',  color: '#3fa535', maxKwh: 50 },
  { label: 'B',  color: '#8cc63f', maxKwh: 75 },
  { label: 'C',  color: '#d4e157', maxKwh: 100 },
  { label: 'D',  color: '#fdd835', maxKwh: 130 },
  { label: 'E',  color: '#ffb300', maxKwh: 160 },
  { label: 'F',  color: '#fb8c00', maxKwh: 200 },
  { label: 'G',  color: '#f4511e', maxKwh: 250 },
  { label: 'H',  color: '#c62828', maxKwh: 999 },
];

function getClassColor(cls: EnergyEfficiencyClass): string {
  return EFFICIENCY_CLASSES.find(c => c.label === cls)?.color || '#888';
}

const txt = {
  de: {
    title: "GEBÄUDE-ENERGIEAUSWEIS",
    subtitle: "gemäß den §§ 79 ff. des Gebäudeenergiegesetzes (GEG)",
    buildingType: "Gebäudeart",
    address: "Adresse / Standort",
    constYear: "Baujahr",
    area: "Nettoraumfläche",
    primaryEnergyCarrier: "Primärenergieträger",
    ventilation: "Lüftungskonzept",
    issuer: "Aussteller",
    date: "Ausstellungsdatum",
    scaleTitle: "Endenergie- und Primärenergiebedarf",
    scaleSubtitle: "Anforderungen gemäß GEG. Vergleichswerte der Effizienzklassen in kWh/(m²·a).",
    primaryEnergy: "Primärenergiebedarf",
    siteEnergy: "Endenergiebedarf",
    category: "Energieverbrauch nach Kategorie",
    absolute: "Gesamtbedarf (kWh/a)",
    specific: "Spezifisch (kWh/m²a)",
    proportion: "Anteil",
    recommendations: "Modernisierungsempfehlungen (freiwillige Angaben)",
    printBtn: "PDF drucken / speichern",
    optionsTitle: "Zertifikat anpassen",
    optionsSubtitle: "Verfeinern Sie die Angaben für den PDF-Export.",
    previewTitle: "PDF Druck-Vorschau (A4)",
    closeBtn: "Schließen",
    yourBuilding: "Ihr Gebäude",
    primaryEnergyShort: "Primärenergie",
    siteEnergyShort: "Endenergie",
    energyUnit: "kWh/(m²·a)",
    residential: "Wohngebäude (Mehrfamilienhaus)",
    nonResidential: "Nichtwohngebäude (Büro/Gewerbe)",
    singleFamily: "Einfamilienhaus",
    naturalGas: "Erdgas",
    electricityMix: "Strom-Mix (Netzbezug)",
    woodPellets: "Holzpellets",
    districtHeating: "Fernwärme",
    heatPump: "Umweltwärme / Wärmepumpe",
    ventWindow: "Freie Fensterlüftung",
    ventMechanical: "Mechanische Lüftung mit Wärmerückgewinnung",
    ventExhaust: "Abluftanlage",
    generalData: "Allgemeine Angaben zum Gebäude",
    certNo: "Registriernummer (Muster)",
    certVal: "Gültigkeit",
    certValDate: "10 Jahre ab Ausstellung",
    recsA: "Hervorragende Effizienzklasse! Empfohlene weitere Schritte: Installation einer Photovoltaikanlage zur Eigennutzung und Einbau eines Batteriespeichers zur Optimierung des Autarkiegrades.",
    recsC: "Gute bis moderate Effizienz. Empfohlene Maßnahmen: Dämmung der obersten Geschossdecke und Kellerdecke, Austausch alter Fensterscheiben gegen Dreifach-Wärmeschutzverglasung sowie Optimierung des Heizungssystems (hydraulischer Abgleich).",
    recsF: "Hoher Energiebedarf. Dringende energetische Sanierungsmaßnahmen empfohlen: Vollständige Wärmedämmung der Außenwände und des Daches, Austausch des Heizungssystems gegen eine moderne Wärmepumpe oder Pelletheizung, und Installation einer mechanischen Lüftungsanlage mit Wärmerückgewinnung."
  },
  en: {
    title: "BUILDING ENERGY CERTIFICATE",
    subtitle: "in accordance with §§ 79 et seq. of the Building Energy Act (GEG)",
    buildingType: "Building Type",
    address: "Address / Location",
    constYear: "Construction Year",
    area: "Net Floor Area",
    primaryEnergyCarrier: "Primary Energy Carrier",
    ventilation: "Ventilation Concept",
    issuer: "Issuer",
    date: "Date of Issue",
    scaleTitle: "Final Energy and Primary Energy Demand",
    scaleSubtitle: "Requirements per GEG. Efficiency class comparison values in kWh/(m²·a).",
    primaryEnergy: "Primary Energy Demand",
    siteEnergy: "Final Energy Demand",
    category: "Energy Consumption by Category",
    absolute: "Total Demand (kWh/a)",
    specific: "Specific (kWh/m²a)",
    proportion: "Proportion",
    recommendations: "Modernization Recommendations (voluntary details)",
    printBtn: "Print / Save PDF",
    optionsTitle: "Customize Certificate",
    optionsSubtitle: "Refine details for the PDF export.",
    previewTitle: "PDF Print Preview (A4)",
    closeBtn: "Close",
    yourBuilding: "Your Building",
    primaryEnergyShort: "Primary Energy",
    siteEnergyShort: "Final Energy",
    energyUnit: "kWh/(m²·a)",
    residential: "Residential Building (Multi-family)",
    nonResidential: "Non-Residential Building (Office/Commercial)",
    singleFamily: "Single-family House",
    naturalGas: "Natural Gas",
    electricityMix: "Electricity Mix (Grid)",
    woodPellets: "Wood Pellets",
    districtHeating: "District Heating",
    heatPump: "Ambient Heat / Heat Pump",
    ventWindow: "Natural Window Ventilation",
    ventMechanical: "Mechanical Ventilation with Heat Recovery",
    ventExhaust: "Exhaust System Only",
    generalData: "General Building Information",
    certNo: "Registration Number (Sample)",
    certVal: "Validity",
    certValDate: "10 years from issue date",
    recsA: "Excellent efficiency class! Recommended next steps: Installation of a photovoltaic system for self-consumption and addition of a battery storage system to optimize autarky.",
    recsC: "Good to moderate efficiency. Recommended measures: Insulation of the uppermost ceiling and basement ceiling, replacement of old window panes with triple thermal glazing, and heating system optimization (hydraulic balancing).",
    recsF: "High energy demand. Urgent energy retrofitting measures recommended: Full thermal insulation of external walls and roof, replacement of the heating system with a modern heat pump or pellet boiler, and installation of mechanical ventilation with heat recovery."
  }
};

export function EnergyPassPdfPreview({ isOpen, onOpenChange, language, data }: EnergyPassPdfPreviewProps) {
  const t = txt[language];

  // Customizable fields state
  const [buildingType, setBuildingType] = useState<string>(
    data.buildingInfo.area > 250 ? t.residential : t.singleFamily
  );
  const [address, setAddress] = useState<string>(data.buildingInfo.environment || 'Musterstraße 42, 52062 Aachen');
  const [constYear, setConstYear] = useState<string>('2022');
  const [primaryCarrier, setPrimaryCarrier] = useState<string>(t.heatPump);
  const [ventilation, setVentilation] = useState<string>(t.ventMechanical);
  const [issuer, setIssuer] = useState<string>('BIMCoach AI Studio');
  const [issueDate, setIssueDate] = useState<string>(new Date().toLocaleDateString('de-DE'));

  const activeColor = getClassColor(data.efficiencyClass);

  // Dynamic recommendations depending on energy class
  const getRecommendations = () => {
    const letter = data.efficiencyClass;
    if (['A+', 'A', 'B'].includes(letter)) return t.recsA;
    if (['C', 'D', 'E'].includes(letter)) return t.recsC;
    return t.recsF;
  };

  const handlePrint = () => {
    const el = document.getElementById('printable-energy-pass');
    if (!el) return;

    const pw = window.open('', '_blank', 'width=794,height=1123');
    if (!pw) {
      alert('Bitte erlauben Sie Pop-ups für diese Seite und versuchen Sie es erneut.');
      return;
    }

    // Copy all <link rel="stylesheet"> tags (Tailwind, fonts, etc.)
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.outerHTML)
      .join('\n');

    // Copy <style> tags but exclude our own component print rules to avoid conflicts
    const styleTags = Array.from(document.querySelectorAll('style'))
      .filter(s => !s.textContent?.includes('#printable-energy-pass'))
      .map(s => s.outerHTML)
      .join('\n');

    pw.document.open();
    pw.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Energieausweis – BIMCoach</title>
  ${linkTags}
  ${styleTags}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      width: 210mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 0; }
    .print-page-break {
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
    }
    .print-page-last {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  ${el.innerHTML}
</body>
</html>`);
    pw.document.close();

    // Print after styles have loaded
    pw.addEventListener('load', () => {
      pw.focus();
      pw.print();
      pw.close();
    });

    // Fallback: some browsers don't fire load for document.write
    setTimeout(() => {
      if (pw && !pw.closed) {
        pw.focus();
        pw.print();
      }
    }, 1500);
  };

  // Convert categories names to human-readable per language
  const translateCategory = (cat: string) => {
    const mapping: Record<string, { de: string; en: string }> = {
      'Heating': { de: 'Heizung (Raumwärme)', en: 'Space Heating' },
      'Heizung': { de: 'Heizung (Raumwärme)', en: 'Space Heating' },
      'Cooling': { de: 'Kühlung / Klimatisierung', en: 'Space Cooling' },
      'Kühlung': { de: 'Kühlung / Klimatisierung', en: 'Space Cooling' },
      'Interior Lighting': { de: 'Innenbeleuchtung', en: 'Interior Lighting' },
      'Beleuchtung': { de: 'Innenbeleuchtung', en: 'Interior Lighting' },
      'Water Systems': { de: 'Warmwasserbereitung', en: 'Domestic Hot Water' },
      'Warmwasser': { de: 'Warmwasserbereitung', en: 'Domestic Hot Water' },
      'Fans': { de: 'Lüftungsventilatoren', en: 'Ventilation Fans' },
      'Lüftung': { de: 'Lüftungsventilatoren', en: 'Ventilation Fans' },
      'Pumps': { de: 'Pumpsysteme / Hilfsenergie', en: 'Pumps / Auxiliaries' },
      'Hilfsenergie': { de: 'Pumpsysteme / Hilfsenergie', en: 'Pumps / Auxiliaries' },
      'Gesamtenergie': { de: 'Gesamtbedarf', en: 'Total Demand' },
      'Total': { de: 'Gesamtbedarf', en: 'Total Demand' },
    };
    return mapping[cat]?.[language] || cat;
  };

  // Sort enduses by value descending
  const sortedEndUses = [...data.endUses]
    .filter(eu => eu.category !== 'Gesamtenergie' && eu.category !== 'Total')
    .sort((a, b) => b.value - a.value);

  const totalEndUse = sortedEndUses.reduce((sum, eu) => sum + eu.value, 0);

  // Position percentage calculations for energy scale pointers
  // Range is from 0 to 300 kWh/m²a
  const getScalePosition = (val: number) => {
    const percent = (val / 300) * 100;
    return `${Math.min(100, Math.max(0, percent))}%`;
  };

  const primaryEnergyPos = getScalePosition(data.sourceEnergy.perArea);
  const siteEnergyPos = getScalePosition(data.siteEnergy.perArea);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1300px] h-[90vh] flex flex-col p-0 overflow-hidden bg-background border shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary animate-pulse" />
              {t.previewTitle}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Desktop Split View: Left Customizer, Right Scrollable PDF */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-muted/20">
          {/* Left Customizer Sidebar */}
          <div className="w-[380px] border-r bg-card flex flex-col overflow-y-auto shrink-0 p-6 space-y-6">
            <div>
              <h3 className="font-bold text-sm tracking-wide uppercase text-muted-foreground mb-1">{t.optionsTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.optionsSubtitle}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="building-type" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.buildingType}
                </Label>
                <Select value={buildingType} onValueChange={setBuildingType}>
                  <SelectTrigger id="building-type" className="h-9 text-xs">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={t.residential}>{t.residential}</SelectItem>
                    <SelectItem value={t.singleFamily}>{t.singleFamily}</SelectItem>
                    <SelectItem value={t.nonResidential}>{t.nonResidential}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.address}
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="const-year" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.constYear}
                  </Label>
                  <Input
                    id="const-year"
                    value={constYear}
                    onChange={(e) => setConstYear(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="net-area" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.area}
                  </Label>
                  <Input
                    id="net-area"
                    value={`${data.buildingInfo.area.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })} m²`}
                    disabled
                    className="h-9 text-xs font-mono bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="primary-carrier" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.primaryEnergyCarrier}
                </Label>
                <Select value={primaryCarrier} onValueChange={setPrimaryCarrier}>
                  <SelectTrigger id="primary-carrier" className="h-9 text-xs">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={t.heatPump}>{t.heatPump}</SelectItem>
                    <SelectItem value={t.electricityMix}>{t.electricityMix}</SelectItem>
                    <SelectItem value={t.naturalGas}>{t.naturalGas}</SelectItem>
                    <SelectItem value={t.districtHeating}>{t.districtHeating}</SelectItem>
                    <SelectItem value={t.woodPellets}>{t.woodPellets}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ventilation" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.ventilation}
                </Label>
                <Select value={ventilation} onValueChange={setVentilation}>
                  <SelectTrigger id="ventilation" className="h-9 text-xs">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={t.ventMechanical}>{t.ventMechanical}</SelectItem>
                    <SelectItem value={t.ventWindow}>{t.ventWindow}</SelectItem>
                    <SelectItem value={t.ventExhaust}>{t.ventExhaust}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issuer" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.issuer}
                </Label>
                <Input
                  id="issuer"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issue-date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.date}
                </Label>
                <Input
                  id="issue-date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="pt-4 border-t mt-auto space-y-3">
              <Button onClick={handlePrint} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20 transition-all duration-300">
                <Printer className="w-5 h-5" />
                {t.printBtn}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-10 font-medium">
                {t.closeBtn}
              </Button>
            </div>
          </div>

          {/* Right Live Preview Area */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 scroll-smooth select-none">
            {/* Page 1 (Cover, Scale) */}
            <div className="pdf-preview-page bg-white text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden flex flex-col p-12 transition-all duration-300"
              style={{
                width: '210mm',
                height: '297mm',
                minHeight: '297mm',
                maxHeight: '297mm',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
              
              {/* Header Decorative Band */}
              <div className="bg-slate-900 text-white p-6 -mx-12 -mt-12 flex flex-col justify-between relative">
                <div className="absolute right-6 top-6 flex items-center justify-center border border-white/20 px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-wider opacity-60">
                  {t.certNo}: DE-2026-9002-IFC
                </div>
                <h1 className="text-2xl font-black tracking-tight font-headline">{t.title}</h1>
                <p className="text-xs text-slate-300 font-medium mt-1 uppercase tracking-wider">{t.subtitle}</p>
              </div>

              {/* General Building Data Grid */}
              <div className="mt-8">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase border-b-2 border-slate-900 pb-1 mb-4 flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-900" />
                  {t.generalData}
                </h2>
                
                <div className="grid grid-cols-2 border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.buildingType}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold">{buildingType}</div>

                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.address}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold truncate" title={address}>{address}</div>

                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.constYear}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold font-mono">{constYear}</div>

                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.area}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold font-mono">{data.buildingInfo.area.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })} m²</div>

                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.primaryEnergyCarrier}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold">{primaryCarrier}</div>

                  <div className="border-r border-b border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.ventilation}</div>
                  <div className="border-b border-slate-200 p-3 text-slate-900 font-semibold">{ventilation}</div>

                  <div className="border-r border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.issuer}</div>
                  <div className="p-3 text-slate-900 font-semibold">{issuer}</div>

                  <div className="border-r border-l border-slate-200 p-3 bg-slate-50 font-bold text-slate-700">{t.date}</div>
                  <div className="p-3 text-slate-900 font-semibold font-mono">{issueDate}</div>
                </div>
              </div>

              {/* Energy Scale Section */}
              <div className="mt-8 flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 mb-10">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase">
                    {t.scaleTitle}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.certVal}: {t.certValDate}</span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed -mt-6 mb-16 font-medium">
                  {t.scaleSubtitle}
                </p>

                {/* Horizontal scale arrow visual */}
                <div className="relative w-full h-8 flex items-center mb-16 px-4">
                  {/* Energy class pointer: Primary energy above */}
                  <div className="absolute transition-all duration-500 -top-12 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: primaryEnergyPos }}>
                    <span className="bg-slate-900 text-white font-black text-[9px] uppercase px-2 py-1 rounded shadow-md whitespace-nowrap tracking-wide flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
                      {t.primaryEnergyShort}: {data.sourceEnergy.perArea.toFixed(1)} {t.energyUnit}
                    </span>
                    <div className="w-0.5 h-6 bg-slate-900 mt-1" />
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-900 -mt-1" />
                  </div>

                  {/* Horizontal Bar with ticks */}
                  <div className="relative w-full h-6 rounded-md flex overflow-hidden shadow-inner border border-slate-200">
                    {EFFICIENCY_CLASSES.map((cls) => (
                      <div
                        key={cls.label}
                        className="h-full flex items-center justify-center text-white font-extrabold text-[10px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] relative"
                        style={{
                          background: cls.color,
                          flex: 1
                        }}
                      >
                        <span>{cls.label}</span>
                        {/* Right boundary indicator tick */}
                        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20" />
                      </div>
                    ))}
                  </div>

                  {/* Ticks values under the bar */}
                  <div className="absolute left-4 right-4 -bottom-6 flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                    <span>0</span>
                    <span>30</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                    <span>130</span>
                    <span>160</span>
                    <span>200</span>
                    <span>250</span>
                    <span>300+</span>
                  </div>

                  {/* Energy class pointer: Final energy below */}
                  <div className="absolute transition-all duration-500 -bottom-16 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: siteEnergyPos }}>
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-sky-700 -mb-1" />
                    <div className="w-0.5 h-6 bg-sky-700 mb-1" />
                    <span className="bg-sky-700 text-white font-black text-[9px] uppercase px-2 py-1 rounded shadow-md whitespace-nowrap tracking-wide flex items-center gap-1">
                      <Building className="w-2.5 h-2.5 text-white" />
                      {t.siteEnergyShort}: {data.siteEnergy.perArea.toFixed(1)} {t.energyUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Large Class Badge Badge */}
              <div className="mt-8 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm relative">
                <div className="space-y-1">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{t.yourBuilding}</p>
                  <p className="text-slate-900 font-black text-lg tracking-tight">
                    {t.buildingType} · {data.buildingInfo.name}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {address}
                  </p>
                </div>

                {/* Styled seal badge representing Energy Efficiency Class */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">EFFIZIENZKLASSE</span>
                    <span className="text-xs font-black uppercase mt-1" style={{ color: activeColor }}>
                      {tr(language, 'Klasse', 'Class')} {data.efficiencyClass}
                    </span>
                  </div>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md border-4 border-white transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
                      boxShadow: `0 4px 15px ${activeColor}50`
                    }}>
                    {data.efficiencyClass}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between text-[8px] text-slate-400 font-semibold font-mono tracking-wider">
                <span>BIMCOACH STUDIO &copy; 2026</span>
                <span>GEG / ENEV KONFORMER ENERGIEBEDARFSAUSWEIS</span>
                <span>PAGE 1 OF 2</span>
              </div>
            </div>

            {/* Page 2 (Breakdown, recommendations) */}
            <div className="pdf-preview-page bg-white text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden flex flex-col p-12 transition-all duration-300"
              style={{
                width: '210mm',
                height: '297mm',
                minHeight: '297mm',
                maxHeight: '297mm',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>

              {/* Mini Header Page 2 */}
              <div className="border-b-2 border-slate-950 pb-2 flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase">{t.category}</h1>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{t.subtitle}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono font-bold text-slate-400">{t.certNo}: DE-2026-9002-IFC</span>
                </div>
              </div>

              {/* Table of categories */}
              <div className="mt-6">
                <table className="w-full text-left text-xs border border-slate-100 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-900 text-white font-extrabold uppercase text-[9px] tracking-wider">
                      <th className="p-3">{tr(language, 'Kategorie / Endnutzung', 'Category / End Use')}</th>
                      <th className="p-3 text-right">{t.absolute}</th>
                      <th className="p-3 text-right">{t.specific}</th>
                      <th className="p-3 text-right w-[180px]">{t.proportion}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedEndUses.map((eu, idx) => {
                      const share = totalEndUse > 0 ? (eu.value / totalEndUse) * 100 : 0;
                      const specificVal = eu.value / data.buildingInfo.area;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 font-medium text-slate-700">
                          <td className="p-3 font-bold text-slate-900">{translateCategory(eu.category)}</td>
                          <td className="p-3 text-right font-mono">{eu.value.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                          <td className="p-3 text-right font-mono">{specificVal.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Horizontal CSS Bar Chart representing percentage share */}
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200/50">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${share}%`,
                                    background: `linear-gradient(90deg, hsl(210, 70%, 55%), hsl(220, 80%, 65%))`
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[10px] font-bold text-slate-500 w-10 text-right">{share.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Summary row */}
                    <tr className="bg-slate-50 font-extrabold text-slate-900 uppercase text-[10px] border-t-2 border-slate-900">
                      <td className="p-3">{tr(language, 'Gesamtbedarf (Endenergie)', 'Total Demand (Final Energy)')}</td>
                      <td className="p-3 text-right font-mono">{data.siteEnergy.total.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono">{data.siteEnergy.perArea.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                      <td className="p-3 font-mono text-slate-500 text-[10px] pl-3">100%</td>
                    </tr>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 uppercase text-[10px]">
                      <td className="p-3">{tr(language, 'Gesamtbedarf (Primärenergie)', 'Total Demand (Primary Energy)')}</td>
                      <td className="p-3 text-right font-mono">{data.sourceEnergy.total.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono">{data.sourceEnergy.perArea.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                      <td className="p-3 text-slate-400 font-mono text-[9px] font-semibold pl-3">GEG COMPLIANT</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Recommendations Section */}
              <div className="mt-8">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase border-b-2 border-slate-950 pb-1 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {t.recommendations}
                </h2>
                <div className="rounded-xl border border-slate-200 p-6 bg-slate-50 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-1.5 h-full" style={{ background: activeColor }} />
                  <p className="text-xs font-extrabold text-slate-800 uppercase mb-2 tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeColor }} />
                    {tr(language, `Empfehlungen für Effizienzklasse ${data.efficiencyClass}`, `Recommendations for Efficiency Class ${data.efficiencyClass}`)}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {getRecommendations()}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-200 text-[10px] font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                      {tr(language, 'Maßnahmen sind wirtschaftlich sinnvoll', 'Measures are economically viable')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                      {tr(language, 'Fördermittel über BAFA/KfW möglich', 'Funding through KfW/BAFA possible')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatures & Seal */}
              <div className="mt-8 grid grid-cols-2 gap-8 text-xs border border-slate-100 p-5 rounded-lg bg-slate-50/50">
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-8">Aussteller Unterschrift & Stempel</p>
                  <div className="border-b border-slate-300 pb-2">
                    <span className="font-mono text-xs font-semibold text-slate-400 italic">BIMCoach AI Studio digital sign</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">Aussteller: {issuer}</p>
                </div>

                <div className="flex items-end justify-end">
                  <div className="w-24 h-24 rounded-full border-4 border-double border-slate-300 flex flex-col items-center justify-center text-center p-2 shrink-0 select-none pointer-events-none opacity-40">
                    <span className="text-[8px] font-black text-slate-400 tracking-wider">BIMCOACH</span>
                    <span className="text-[8px] font-black text-slate-400 mt-0.5">STUDIO</span>
                    <span className="text-[6px] font-bold text-slate-400 mt-1 uppercase font-mono">APPROVED</span>
                  </div>
                </div>
              </div>

              {/* Footer Page 2 */}
              <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between text-[8px] text-slate-400 font-semibold font-mono tracking-wider">
                <span>BIMCOACH STUDIO &copy; 2026</span>
                <span>GEG / ENEV KONFORMER ENERGIEBEDARFSAUSWEIS</span>
                <span>PAGE 2 OF 2</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Fallback print CSS – only used if the user presses Ctrl+P directly.
           Normal "PDF drucken" button opens an isolated popup window instead. */}
      <style jsx global>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; visibility: hidden !important; }
          #printable-energy-pass {
            display: block !important; visibility: visible !important;
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 210mm !important; margin: 0 !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          #printable-energy-pass * { visibility: visible !important; }
          @page { size: A4 portrait; margin: 0; }
          .print-page-break { page-break-after: always !important; break-after: page !important; }
          .print-page-last  { page-break-after: avoid  !important; break-after: avoid  !important; }
        }
      `}</style>

      {/* Actual printed markup: hidden on screen, visible only on print */}
      <div id="printable-energy-pass" className="hidden select-none" style={{ width: '210mm', background: '#fff', color: '#0f172a' }}>
        {/* PAGE 1 */}
        <div className="print-page-break flex flex-col p-12 bg-white" style={{ width: '210mm', height: '297mm', minHeight: '297mm', maxHeight: '297mm', overflow: 'hidden', boxSizing: 'border-box' }}>
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 -mx-12 -mt-12 flex flex-col relative" style={{ boxSizing: 'border-box' }}>
            <div className="absolute right-6 top-6 border border-white/20 px-3 py-0.5 rounded-full text-[9px] uppercase font-mono tracking-wider opacity-60">
              {t.certNo}: DE-2026-9002-IFC
            </div>
            <h1 className="text-xl font-black tracking-tight uppercase leading-none">{t.title}</h1>
            <p className="text-[10px] text-slate-300 font-bold mt-1 uppercase tracking-wider">{t.subtitle}</p>
          </div>

          {/* Building General Data */}
          <div className="mt-8">
            <h2 className="text-xs font-black text-slate-900 uppercase border-b-2 border-slate-900 pb-1 mb-4 flex items-center gap-2">
              {t.generalData}
            </h2>
            
            <div className="grid grid-cols-2 border border-slate-200 rounded-lg overflow-hidden text-[10px] leading-tight">
              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.buildingType}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold">{buildingType}</div>

              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.address}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold truncate">{address}</div>

              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.constYear}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold font-mono">{constYear}</div>

              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.area}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold font-mono">{data.buildingInfo.area.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })} m²</div>

              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.primaryEnergyCarrier}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold">{primaryCarrier}</div>

              <div className="border-r border-b border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.ventilation}</div>
              <div className="border-b border-slate-200 p-2 text-slate-900 font-semibold">{ventilation}</div>

              <div className="border-r border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.issuer}</div>
              <div className="p-2 text-slate-900 font-semibold">{issuer}</div>

              <div className="border-r border-l border-slate-200 p-2 bg-slate-50 font-bold text-slate-700">{t.date}</div>
              <div className="p-2 text-slate-900 font-semibold font-mono">{issueDate}</div>
            </div>
          </div>

          {/* Scale section */}
          <div className="mt-12 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 mb-8">
              <h2 className="text-xs font-black text-slate-900 uppercase">
                {t.scaleTitle}
              </h2>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t.certVal}: {t.certValDate}</span>
            </div>

            <p className="text-[9px] text-slate-500 leading-relaxed -mt-5 mb-14 font-medium">
              {t.scaleSubtitle}
            </p>

            {/* Horizontal arrow slider visual for print */}
            <div className="relative w-full h-8 flex items-center mb-16 px-4">
              {/* Primary energy above */}
              <div className="absolute -top-10 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: primaryEnergyPos }}>
                <span className="bg-slate-900 text-white font-extrabold text-[8px] uppercase px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  {t.primaryEnergyShort}: {data.sourceEnergy.perArea.toFixed(1)} {t.energyUnit}
                </span>
                <div className="w-0.5 h-4 bg-slate-900 mt-0.5" />
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-900 -mt-0.5" />
              </div>

              {/* Gradient Bar */}
              <div className="relative w-full h-5 rounded flex overflow-hidden border border-slate-200">
                {EFFICIENCY_CLASSES.map((cls) => (
                  <div
                    key={cls.label}
                    className="h-full flex items-center justify-center text-white font-extrabold text-[8px] relative"
                    style={{
                      background: cls.color,
                      backgroundColor: cls.color,
                      flex: 1
                    }}
                  >
                    <span>{cls.label}</span>
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20" />
                  </div>
                ))}
              </div>

              {/* Ticks values */}
              <div className="absolute left-4 right-4 -bottom-5 flex justify-between text-[8px] font-bold text-slate-500 font-mono">
                <span>0</span>
                <span>30</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
                <span>130</span>
                <span>160</span>
                <span>200</span>
                <span>250</span>
                <span>300+</span>
              </div>

              {/* Final energy below */}
              <div className="absolute -bottom-12 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: siteEnergyPos }}>
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-sky-700 -mb-0.5" />
                <div className="w-0.5 h-4 bg-sky-700 mb-0.5" />
                <span className="bg-sky-700 text-white font-extrabold text-[8px] uppercase px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  {t.siteEnergyShort}: {data.siteEnergy.perArea.toFixed(1)} {t.energyUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Efficiency Seal Container */}
          <div className="mt-8 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-5 relative">
            <div className="absolute right-0 top-0 w-1.5 h-full rounded-r-xl" style={{ backgroundColor: activeColor }} />
            <div className="space-y-1">
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-wider leading-none">{t.yourBuilding}</p>
              <p className="text-slate-900 font-black text-sm tracking-tight leading-tight">
                {t.buildingType} · {data.buildingInfo.name}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {address}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-end leading-none">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">EFFIZIENZKLASSE</span>
                <span className="text-[10px] font-extrabold uppercase mt-1" style={{ color: activeColor }}>
                  {tr(language, 'Klasse', 'Class')} {data.efficiencyClass}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg border-2 border-white shadow"
                style={{
                  background: activeColor,
                  backgroundColor: activeColor
                }}>
                {data.efficiencyClass}
              </div>
            </div>
          </div>

          {/* Footer Page 1 */}
          <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between text-[8px] text-slate-400 font-bold font-mono tracking-wider">
            <span>BIMCOACH STUDIO &copy; 2026</span>
            <span>GEG / ENEV KONFORMER ENERGIEBEDARFSAUSWEIS</span>
            <span>PAGE 1 OF 2</span>
          </div>
        </div>

        {/* PAGE 2 */}
        <div className="print-page-last flex flex-col p-12 bg-white" style={{ width: '210mm', height: '297mm', minHeight: '297mm', maxHeight: '297mm', overflow: 'hidden', boxSizing: 'border-box' }}>
          {/* Page 2 header */}
          <div className="border-b-2 border-slate-950 pb-1.5 flex items-center justify-between">
            <div>
              <h1 className="text-xs font-black tracking-tight text-slate-900 uppercase leading-none">{t.category}</h1>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t.subtitle}</p>
            </div>
            <div className="text-right leading-none">
              <span className="text-[8px] font-mono font-bold text-slate-400">{t.certNo}: DE-2026-9002-IFC</span>
            </div>
          </div>

          {/* Categories table */}
          <div className="mt-6">
            <table className="w-full text-left text-[10px] border border-slate-150 rounded overflow-hidden">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase text-[8px] tracking-wider">
                  <th className="p-2">{tr(language, 'Kategorie / Endnutzung', 'Category / End Use')}</th>
                  <th className="p-2 text-right">{t.absolute}</th>
                  <th className="p-2 text-right">{t.specific}</th>
                  <th className="p-2 text-right w-[150px]">{t.proportion}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {sortedEndUses.map((eu, idx) => {
                  const share = totalEndUse > 0 ? (eu.value / totalEndUse) * 100 : 0;
                  const specificVal = eu.value / data.buildingInfo.area;

                  return (
                    <tr key={idx} className="font-semibold text-slate-700">
                      <td className="p-2 font-black text-slate-900">{translateCategory(eu.category)}</td>
                      <td className="p-2 text-right font-mono">{eu.value.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="p-2 text-right font-mono">{specificVal.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${share}%`,
                                background: '#1e293b',
                                backgroundColor: '#1e293b'
                              }}
                            />
                          </div>
                          <span className="font-mono text-[9px] font-bold text-slate-500 w-8 text-right">{share.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Total demand */}
                <tr className="bg-slate-50 font-black text-slate-900 uppercase text-[9px] border-t-2 border-slate-900">
                  <td className="p-2">{tr(language, 'Gesamtbedarf (Endenergie)', 'Total Demand (Final Energy)')}</td>
                  <td className="p-2 text-right font-mono">{data.siteEnergy.total.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="p-2 text-right font-mono">{data.siteEnergy.perArea.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                  <td className="p-2 font-mono text-slate-500 pl-2">100%</td>
                </tr>
                <tr className="bg-slate-100 font-black text-slate-900 uppercase text-[9px]">
                  <td className="p-2">{tr(language, 'Gesamtbedarf (Primärenergie)', 'Total Demand (Primary Energy)')}</td>
                  <td className="p-2 text-right font-mono">{data.sourceEnergy.total.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="p-2 text-right font-mono">{data.sourceEnergy.perArea.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 })}</td>
                  <td className="p-2 text-slate-400 font-mono text-[8px] font-bold pl-2">GEG COMPLIANT</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recommendations block */}
          <div className="mt-8">
            <h2 className="text-xs font-black text-slate-900 uppercase border-b-2 border-slate-950 pb-1 mb-3">
              {t.recommendations}
            </h2>
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-1 h-full" style={{ backgroundColor: activeColor }} />
              <p className="text-[10px] font-extrabold text-slate-800 uppercase mb-1 tracking-wide">
                {tr(language, `Empfehlungen für Effizienzklasse ${data.efficiencyClass}`, `Recommendations for Efficiency Class ${data.efficiencyClass}`)}
              </p>
              <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                {getRecommendations()}
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-[10px] border border-slate-150 p-4 rounded-lg bg-slate-50/50">
            <div>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-wider mb-8">Aussteller Unterschrift & Stempel</p>
              <div className="border-b border-slate-300 pb-1">
                <span className="font-mono text-[10px] text-slate-400 italic">BIMCoach AI Studio digital sign</span>
              </div>
              <p className="text-[9px] text-slate-500 font-bold mt-1">Aussteller: {issuer}</p>
            </div>

            <div className="flex items-end justify-end">
              <div className="w-20 h-20 rounded-full border-4 border-double border-slate-300 flex flex-col items-center justify-center text-center p-1 shrink-0 opacity-40">
                <span className="text-[7px] font-black text-slate-400 tracking-wider">BIMCOACH</span>
                <span className="text-[7px] font-black text-slate-400 mt-0.5">STUDIO</span>
                <span className="text-[5px] font-bold text-slate-400 mt-1 uppercase font-mono">APPROVED</span>
              </div>
            </div>
          </div>

          {/* Footer Page 2 */}
          <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between text-[8px] text-slate-400 font-bold font-mono tracking-wider">
            <span>BIMCOACH STUDIO &copy; 2026</span>
            <span>GEG / ENEV KONFORMER ENERGIEBEDARFSAUSWEIS</span>
            <span>PAGE 2 OF 2</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
