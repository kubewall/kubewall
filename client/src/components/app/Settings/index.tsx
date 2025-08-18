import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { applyThemePalette, ensurePaletteWithDefaults, loadThemePalette, saveThemePalette, ThemePalette, PRESET_THEMES } from '@/utils/theme';

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id} className="min-w-40">{label}</Label>
      <Input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-16 h-10 p-1" />
      <Input id={id + '-hex'} value={value} onChange={(e) => onChange(e.target.value)} className="w-36" />
      <div className="w-10 h-10 rounded-md border" style={{ backgroundColor: value }} />
    </div>
  );
}

function ExtrasEditor({ mode, extras, onChange }: { mode: 'light' | 'dark'; extras: Record<string, string>; onChange: (name: string, hex: string) => void }) {
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#8b5cf6');
  const entries = useMemo(() => Object.entries(extras), [extras]);

  return (
    <div className="space-y-3">
      {entries.length === 0 && <div className="text-sm text-muted-foreground">No extra colors yet.</div>}
      {entries.map(([name, hex]) => (
        <div key={`${mode}-${name}`} className="flex items-center gap-3">
          <Label className="min-w-40">{name}</Label>
          <Input type="color" value={hex} onChange={(e) => onChange(name, e.target.value)} className="w-16 h-10 p-1" />
          <Input value={hex} onChange={(e) => onChange(name, e.target.value)} className="w-36" />
          <div className="w-10 h-10 rounded-md border" style={{ backgroundColor: hex }} />
        </div>
      ))}
      <Separator className="my-2" />
      <div className="flex items-center gap-3">
        <Input placeholder="name (e.g., accent)" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-48" />
        <Input type="color" value={newHex} onChange={(e) => setNewHex(e.target.value)} className="w-16 h-10 p-1" />
        <Input value={newHex} onChange={(e) => setNewHex(e.target.value)} className="w-36" />
        <Button
          onClick={() => {
            const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
            if (!name) return;
            onChange(name, newHex);
            setNewName('');
          }}
        >Add</Button>
      </div>
    </div>
  );
}

export function Settings() {
  const initialPalette = ensurePaletteWithDefaults(loadThemePalette());

  const detectPresetName = (pal: ThemePalette): string => {
    const normalize = (s?: string) => (s || '').toLowerCase();
    const extrasEqual = (a?: Record<string, string>, b?: Record<string, string>) => {
      const aKeys = Object.keys(a || {}).sort();
      const bKeys = Object.keys(b || {}).sort();
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((k, i) => k === bKeys[i] && normalize((a || {})[k]) === normalize((b || {})[k]));
    };
    const eq = (x: ThemePalette, y: ThemePalette) =>
      normalize(x.light.primary) === normalize(y.light.primary) &&
      normalize(x.light.secondary) === normalize(y.light.secondary) &&
      normalize(x.light.background) === normalize(y.light.background) &&
      extrasEqual(x.light.extras, y.light.extras) &&
      normalize(x.dark.primary) === normalize(y.dark.primary) &&
      normalize(x.dark.secondary) === normalize(y.dark.secondary) &&
      normalize(x.dark.background) === normalize(y.dark.background) &&
      extrasEqual(x.dark.extras, y.dark.extras);

    for (const name of Object.keys(PRESET_THEMES)) {
      if (eq(pal, PRESET_THEMES[name])) return name;
    }
    return 'Custom';
  };

  const [palette, setPalette] = useState<ThemePalette>(initialPalette);
  const [preview, setPreview] = useState<ThemePalette>(initialPalette);
  const [selectedPreset, setSelectedPreset] = useState<string>(detectPresetName(initialPalette));

  // No live-apply: changes are only applied on Save

  const update = (mode: 'light' | 'dark', key: 'primary' | 'secondary' | 'background', value: string) => {
    setPreview((p) => ({
      ...p,
      [mode]: {
        ...p[mode],
        [key]: value
      }
    }));
  };

  const updateExtra = (mode: 'light' | 'dark', name: string, hex: string) => {
    setPreview((p) => ({
      ...p,
      [mode]: {
        ...p[mode],
        extras: { ...(p[mode].extras || {}), [name]: hex }
      }
    }));
  };

  const removeAllExtras = (mode: 'light' | 'dark') => {
    setPreview((p) => ({
      ...p,
      [mode]: { ...p[mode], extras: {} }
    }));
  };

  const resetDefaults = () => {
    const def = ensurePaletteWithDefaults(null);
    setPalette(def);
    setPreview(def);
    setSelectedPreset('Facets');
  };

  const save = () => {
    saveThemePalette(preview);
    applyThemePalette(preview);
    setPalette(preview);
    setSelectedPreset(detectPresetName(preview));
  };

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">Configure primary, secondary and background colors for light and dark modes. Add extra named colors that map to CSS variables for use across the app.</div>
          <div className="flex items-center gap-3">
            <Label className="min-w-40">Preset</Label>
            <Select value={selectedPreset} onValueChange={(name) => {
              setSelectedPreset(name);
              const preset = PRESET_THEMES[name];
              if (preset) {
                setPreview(preset);
              }
            }}>
              <SelectTrigger className="w-52 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Custom" disabled>Custom</SelectItem>
                {Object.keys(PRESET_THEMES).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setPreview(palette)}>Revert unsaved changes</Button>
          </div>
          <Tabs defaultValue="light" className="w-full">
            <TabsList>
              <TabsTrigger value="light">Light</TabsTrigger>
              <TabsTrigger value="dark">Dark</TabsTrigger>
            </TabsList>
            <TabsContent value="light" className="space-y-4">
              <ColorInput id="light-primary" label="Primary" value={preview.light.primary} onChange={(v) => update('light', 'primary', v)} />
              <ColorInput id="light-secondary" label="Secondary" value={preview.light.secondary} onChange={(v) => update('light', 'secondary', v)} />
              <ColorInput id="light-bg" label="Background" value={preview.light.background || '#FFFFFF'} onChange={(v) => update('light', 'background', v)} />
              <Separator />
              <ExtrasEditor mode="light" extras={preview.light.extras || {}} onChange={(name, hex) => updateExtra('light', name, hex)} />
              <div>
                <Button variant="secondary" onClick={() => removeAllExtras('light')}>Clear extras</Button>
              </div>
            </TabsContent>
            <TabsContent value="dark" className="space-y-4">
              <ColorInput id="dark-primary" label="Primary" value={preview.dark.primary} onChange={(v) => update('dark', 'primary', v)} />
              <ColorInput id="dark-secondary" label="Secondary" value={preview.dark.secondary} onChange={(v) => update('dark', 'secondary', v)} />
              <ColorInput id="dark-bg" label="Background" value={preview.dark.background || '#282A36'} onChange={(v) => update('dark', 'background', v)} />
              <Separator />
              <ExtrasEditor mode="dark" extras={preview.dark.extras || {}} onChange={(name, hex) => updateExtra('dark', name, hex)} />
              <div>
                <Button variant="secondary" onClick={() => removeAllExtras('dark')}>Clear extras</Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={resetDefaults}>Reset to defaults</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;


