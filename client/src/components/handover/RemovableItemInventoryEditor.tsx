import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { RemovableItemInventoryEntry, RemovableItemCondition } from "./types";

interface Props {
  value: RemovableItemInventoryEntry[];
  onChange: (next: RemovableItemInventoryEntry[]) => void;
}

export default function RemovableItemInventoryEditor({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<RemovableItemInventoryEntry>) => {
    const next = value.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, { item: "", present: true, condition: "good" }]);

  return (
    <div className="space-y-2">
      {value.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="flex-1"
            placeholder="Item name"
            value={entry.item}
            onChange={(e) => update(i, { item: e.target.value })}
            data-testid={`inventory-item-name-${i}`}
          />
          <label className="flex items-center gap-1 text-sm whitespace-nowrap">
            <Checkbox checked={entry.present} onCheckedChange={(checked) => update(i, { present: Boolean(checked) })} />
            Present
          </label>
          <Select value={entry.condition} onValueChange={(v) => update(i, { condition: v as RemovableItemCondition })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} aria-label="Remove item">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Add item
      </Button>
    </div>
  );
}
