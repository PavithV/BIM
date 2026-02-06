import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Box, Layers, Home, MapPin, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SpatialNode {
    expressID: number;
    type: string;
    children: SpatialNode[];
}

interface ModelTreeProps {
    tree: SpatialNode | null;
    onSelect: (id: number) => void;
    selectedId: number | null;
}

const TreeNode = ({
    node,
    depth = 0,
    onSelect,
    selectedId,
}: {
    node: SpatialNode;
    depth?: number;
    onSelect: (id: number) => void;
    selectedId: number | null;
}) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
    const hasChildren = node.children && node.children.length > 0;

    // Auto-expand if a child is selected
    useEffect(() => {
        if (!hasChildren) return;
        const containsSelection = (n: SpatialNode): boolean => {
            if (n.expressID === selectedId) return true;
            return n.children?.some(containsSelection) || false;
        };
        if (containsSelection(node)) {
            setIsExpanded(true);
        }
    }, [selectedId, node, hasChildren]);

    const getIcon = (type: string) => {
        if (type === 'IFCPROJECT') return <MapPin className="w-4 h-4 text-orange-500" />;
        if (type === 'IFCSITE') return <MapPin className="w-4 h-4 text-green-500" />;
        if (type === 'IFCBUILDING') return <Building className="w-4 h-4 text-blue-500" />;
        if (type === 'IFCBUILDINGSTOREY') return <Layers className="w-4 h-4 text-purple-500" />;
        return <Box className="w-4 h-4 text-gray-500" />;
    };

    const isSelected = node.expressID === selectedId;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center py-1 px-2 hover:bg-accent/50 cursor-pointer rounded-sm transition-colors text-sm",
                    isSelected && "bg-accent font-medium text-accent-foreground"
                )}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.expressID);
                }}
            >
                <div
                    className="mr-1 p-0.5 hover:bg-muted rounded shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) setIsExpanded(!isExpanded);
                    }}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                    ) : <div className="w-3 h-3" />}
                </div>

                <span className="mr-2 shrink-0">{getIcon(node.type)}</span>
                <span className="truncate">{node.type} <span className="text-xs text-muted-foreground ml-1">#{node.expressID}</span></span>
            </div>

            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.expressID}
                            node={child}
                            depth={depth + 1}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function ModelTree({ tree, onSelect, selectedId }: ModelTreeProps) {
    if (!tree) {
        return (
            <div className="p-4 text-center text-sm text-muted-foreground">
                Keine Strukturdaten verfügbar.
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-2">
            <TreeNode node={tree} onSelect={onSelect} selectedId={selectedId} />
        </div>
    );
}
