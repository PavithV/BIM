
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export interface MaterialReplacement {
    original: string;
    replacement: string | null;
    originalEntry: any | null; // Keep flexible
    suggestions?: string[];
}

interface MaterialReviewModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    replacements: MaterialReplacement[]
    onConfirm: (approvedMap: Record<string, string>) => void
    isProcessing?: boolean
}

export function MaterialReviewModal({
    isOpen,
    onOpenChange,
    replacements,
    onConfirm,
    isProcessing = false,
}: MaterialReviewModalProps) {
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})

    // Initialize all to selected by default and set default values
    useEffect(() => {
        if (isOpen && replacements.length > 0) {
            const initialSelected: Record<string, boolean> = {}
            const initialValues: Record<string, string> = {}

            replacements.forEach(r => {
                initialSelected[r.original] = true
                if (r.replacement) {
                    initialValues[r.original] = r.replacement
                }
            })
            setSelected(initialSelected)
            setSelectedValues(initialValues)
        }
    }, [isOpen, replacements])

    const handleToggle = (original: string) => {
        setSelected(prev => ({
            ...prev,
            [original]: !prev[original]
        }))
    }

    const handleConfirm = () => {
        const approvedMap: Record<string, string> = {}
        replacements.forEach(r => {
            // Use the selected value from dropdown if available, otherwise original replacement logic
            // But actually selectedValues should always be populated if replacement existed.
            const chosen = selectedValues[r.original] || r.replacement;

            if (selected[r.original] && chosen) {
                approvedMap[r.original] = chosen
            }
        })
        onConfirm(approvedMap)
    }

    const handleValueChange = (original: string, value: string) => {
        setSelectedValues(prev => ({
            ...prev,
            [original]: value
        }))
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Material-Ersetzungen prüfen</DialogTitle>
                    <DialogDescription>
                        Wir haben für einige Materialien aus Ihrer IFC-Datei bessere Übereinstimmungen in unserer Ökobilanz-Datenbank gefunden.
                        Bitte wählen Sie aus, welche Ersetzungen durchgeführt werden sollen.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-4 font-semibold text-sm mb-2 px-2 text-muted-foreground">
                        <div>Original (IFC)</div>
                        <div></div>
                        <div>Vorschlag (Datenbank)</div>
                        <div>Ersetzen?</div>
                    </div>
                    <ScrollArea className="h-[300px] rounded-md border p-2">
                        <div className="space-y-2">
                            {replacements.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-4 p-2 rounded hover:bg-muted/50 transition-colors text-sm">
                                    <div className="truncate" title={item.original}>{item.original}</div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50" />

                                    {/* Dropdown or Single Value */}
                                    <div className="min-w-0">
                                        {item.suggestions && item.suggestions.length > 1 ? (
                                            <Select
                                                value={selectedValues[item.original] || item.replacement || ''}
                                                onValueChange={(val) => handleValueChange(item.original, val)}
                                                disabled={!selected[item.original]}
                                            >
                                                <SelectTrigger className="h-8 w-full text-xs">
                                                    <SelectValue placeholder="Wähle Material" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {item.suggestions.map((s) => (
                                                        <SelectItem key={s} value={s} className="text-xs">
                                                            {s}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="truncate font-medium text-primary text-sm" title={item.replacement || ''}>
                                                {item.replacement}
                                            </div>
                                        )}
                                    </div>
                                    <Checkbox
                                        id={`check-${idx}`}
                                        checked={selected[item.original] || false}
                                        onCheckedChange={() => handleToggle(item.original)}
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Abbrechen</Button>
                    <Button onClick={handleConfirm} disabled={isProcessing}>
                        {isProcessing ? 'Verarbeite...' : 'Auswahl bestätigen & Fortfahren'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
