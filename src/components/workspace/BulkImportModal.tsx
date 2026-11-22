import { useState } from 'react';
import { FileJson, Loader2, Upload, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { CityDoc, PlaceDoc } from '../../types.ts';

interface BulkImportModalProps {
  open: boolean;
  city: CityDoc;
  onClose: () => void;
  onImported: (places: PlaceDoc[], skippedCount: number) => void;
  onError: (msg: string) => void;
}

export function BulkImportModal({
  open,
  city,
  onClose,
  onImported,
  onError,
}: BulkImportModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const insertSample = () => {
    const sample = [
      {
        id: `${city.id}_central_museum`,
        name: 'Central Museum',
        subtitle: 'Historic sculptures and regional artifacts gallery',
        category: 'HERITAGE',
        subCategories: ['Museums'],
        tags: ['artifacts', 'history'],
        imageUrl: '/src/assets/images/heritage_palace_place_1795363554854.jpg',
        description: 'Curated municipal museum housing Paramara sculptures and heritage collections.',
        rating: 4.5,
        reviewCountLabel: '3.2k Reviews',
        distanceLabel: '2.1 km',
        openHours: '10:00 AM – 5:00 PM',
        phone: '',
        address: `Museum Road, ${city.name}`,
        latitude: city.latitude + 0.005,
        longitude: city.longitude + 0.004,
        isPopular: false,
        isTrending: false,
      },
    ];
    setJsonInput(JSON.stringify(sample, null, 2));
  };

  const handleImport = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      onError('Invalid JSON syntax. Please paste a valid JSON array.');
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      onError('JSON payload must be a non-empty array of place objects.');
      return;
    }

    setImporting(true);
    try {
      const res = await api.bulkImportPlaces(city.id, parsed);
      const skippedCount = res.skipped.length + res.validationErrors.length;
      onImported(res.inserted, skippedCount);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h2 id="bulk-import-title" className="text-base font-bold text-slate-900">
                JSON Bulk Import → {city.collectionName}
              </h2>
              <p className="text-xs text-slate-500">
                Paste a JSON array of places to insert multiple records at once.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">
              Requires <span className="font-mono">name</span>,{' '}
              <span className="font-mono">category</span>,{' '}
              <span className="font-mono">latitude</span>, and{' '}
              <span className="font-mono">longitude</span>.
            </span>
            <button
              type="button"
              onClick={insertSample}
              className="text-xs font-semibold text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap"
            >
              Load Sample JSON
            </button>
          </div>

          <textarea
            rows={12}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[{"id": "example_spot", "name": "Example Spot", "category": "HERITAGE", "latitude": 22.7196, "longitude": 75.8577}]'
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-900 focus:border-[#0284C7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importing || !jsonInput.trim()}
            onClick={() => void handleImport()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importing...' : 'Import Places'}
          </button>
        </div>
      </div>
    </div>
  );
}
