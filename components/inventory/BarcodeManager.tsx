import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    BarChart3, Search, Printer, QrCode, Package,
    Scan, CheckCircle, Tag, ChevronDown, X, Camera, CameraOff, Video
} from 'lucide-react';

interface ItemBarcode {
    id: string;
    code: string;
    name: string;
    uom: string;
    barcode: string | null;
    category?: string;
}

// Simple Code128-style barcode renderer using canvas
const drawBarcode = (canvas: HTMLCanvasElement, data: string, width: number = 300, height: number = 100) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height + 24;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Simple encoding: convert chars to binary bars
    const encode = (char: string): string => {
        const code = char.charCodeAt(0);
        // Create a pseudo-barcode pattern from character code
        let binary = code.toString(2).padStart(8, '0');
        // Add parity bit
        binary += (code % 2).toString();
        return binary;
    };

    // Start pattern
    let pattern = '11010';
    for (const char of data) {
        pattern += encode(char);
        pattern += '0'; // gap
    }
    // Stop pattern
    pattern += '11001';

    const barWidth = Math.max(1, Math.floor((width - 20) / pattern.length));
    const startX = Math.floor((width - pattern.length * barWidth) / 2);

    ctx.fillStyle = '#000000';
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') {
            ctx.fillRect(startX + i * barWidth, 4, barWidth, height - 8);
        }
    }

    // Label text below
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(data, width / 2, height + 18);
};

export const BarcodeManager: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [items, setItems] = useState<ItemBarcode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [scannerInput, setScannerInput] = useState('');
    const [scanResult, setScanResult] = useState<ItemBarcode | null>(null);
    const [scanNotFound, setScanNotFound] = useState(false);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchItems = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('item_master')
                .select('id, code, name, uom, barcode, category')
                .eq('company_id', currentCompanyId)
                .eq('status', 'Active')
                .order('name');
            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const autoGenerateBarcode = async (itemId: string) => {
        const prefix = 'KAA';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const barcode = `${prefix}${timestamp}${random}`;

        try {
            const { error } = await supabase
                .from('item_master')
                .update({ barcode })
                .eq('id', itemId);
            if (error) throw error;
            fetchItems();
        } catch (err: any) {
            alert('Failed to generate barcode: ' + err.message);
        }
    };

    const handleScan = async () => {
        if (!scannerInput.trim() || !currentCompanyId) return;
        setScanNotFound(false);
        setScanResult(null);

        const found = items.find(i =>
            i.barcode?.toLowerCase() === scannerInput.trim().toLowerCase() ||
            i.code.toLowerCase() === scannerInput.trim().toLowerCase()
        );

        if (found) {
            setScanResult(found);
        } else {
            setScanNotFound(true);
        }
    };

    const handleScanKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleScan();
        }
    };

    // Camera scanning functions
    const startCamera = async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraActive(true);

            // Start scanning interval using BarcodeDetector or canvas analysis
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] });
                scanIntervalRef.current = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                const code = barcodes[0].rawValue;
                                if (code) {
                                    setScannerInput(code);
                                    // Auto-lookup
                                    const found = items.find(i =>
                                        i.barcode?.toLowerCase() === code.toLowerCase() ||
                                        i.code.toLowerCase() === code.toLowerCase()
                                    );
                                    if (found) {
                                        setScanResult(found);
                                        setScanNotFound(false);
                                    } else {
                                        setScanNotFound(true);
                                        setScanResult(null);
                                    }
                                    stopCamera();
                                }
                            }
                        } catch { /* scanning frame failed, continue */ }
                    }
                }, 500);
            } else {
                setCameraError('BarcodeDetector API not supported. Use Chrome or Edge for camera scanning.');
            }
        } catch (err: any) {
            setCameraError(err.message || 'Could not access camera');
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    // Cleanup camera on unmount
    useEffect(() => {
        return () => { stopCamera(); };
    }, []);

    const toggleSelect = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const itemsWithBarcode = filteredItems.filter(i => i.barcode);
        if (selectedItems.size === itemsWithBarcode.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(itemsWithBarcode.map(i => i.id)));
        }
    };

    const printBarcodes = () => {
        const toPrint = items.filter(i => selectedItems.has(i.id) && i.barcode);
        if (toPrint.length === 0) {
            alert('Select items with barcodes to print');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Barcode Labels</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', sans-serif; padding: 10mm; }
                .labels { display: flex; flex-wrap: wrap; gap: 10mm; }
                .label { 
                    width: 60mm; height: 35mm; 
                    border: 1px solid #e2e8f0; border-radius: 4px;
                    padding: 3mm; display: flex; flex-direction: column;
                    justify-content: space-between; 
                    page-break-inside: avoid;
                }
                .label-name { font-size: 9px; font-weight: 600; color: #334155; line-height: 1.2; }
                .label-code { font-size: 8px; color: #94a3b8; }
                .label-barcode { text-align: center; margin: 2mm 0; }
                .label-barcode canvas { max-width: 100%; }
                @media print { 
                    body { padding: 5mm; } 
                    .label { border-color: #cbd5e1; }
                }
            </style>
        </head>
        <body>
            <div class="labels">
                ${toPrint.map(item => `
                <div class="label">
                    <div>
                        <div class="label-name">${item.name}</div>
                        <div class="label-code">${item.code} | ${item.uom}</div>
                    </div>
                    <div class="label-barcode">
                        <canvas id="bc-${item.id}"></canvas>
                    </div>
                </div>
                `).join('')}
            </div>
            <script>
                ${drawBarcode.toString()}
                ${toPrint.map(item => `
                    drawBarcode(document.getElementById('bc-${item.id}'), '${item.barcode}', 200, 50);
                `).join('\n')}
                setTimeout(() => window.print(), 300);
            </script>
        </body>
        </html>
        `);
        printWindow.document.close();
    };

    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Barcode Management</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Generate, scan, and print barcode labels for inventory items.
                    </p>
                </div>
                {selectedItems.size > 0 && (
                    <button
                        onClick={printBarcodes}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        Print {selectedItems.size} Labels
                    </button>
                )}
            </div>

            {/* Scanner Section */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                    <Scan className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-slate-800 dark:text-white">Barcode Scanner</h3>
                </div>
                <div className="flex gap-2 max-w-lg">
                    <input
                        ref={scanInputRef}
                        type="text"
                        placeholder="Scan or type barcode / LAT Code..."
                        value={scannerInput}
                        onChange={e => { setScannerInput(e.target.value); setScanNotFound(false); setScanResult(null); }}
                        onKeyDown={handleScanKeyDown}
                        className="flex-1 px-4 py-2.5 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        autoFocus
                    />
                    <button
                        onClick={handleScan}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Look Up
                    </button>
                    <button
                        onClick={cameraActive ? stopCamera : startCamera}
                        className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 ${cameraActive
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                        title={cameraActive ? 'Stop Camera' : 'Use Camera'}
                    >
                        {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                        {cameraActive ? 'Stop' : 'Camera'}
                    </button>
                </div>

                {/* Camera Viewfinder */}
                {cameraActive && (
                    <div className="mt-3 relative rounded-lg overflow-hidden border-2 border-indigo-300 dark:border-indigo-700 bg-black max-w-lg">
                        <video
                            ref={videoRef}
                            className="w-full h-48 object-cover"
                            muted
                            playsInline
                        />
                        {/* Scan target overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-16 border-2 border-emerald-400 rounded-lg opacity-70">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-lg"></div>
                            </div>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                                Point camera at barcode
                            </div>
                        </div>
                    </div>
                )}

                {cameraError && (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Video className="w-3 h-3" /> {cameraError}
                    </div>
                )}

                {scanResult && (
                    <div className="mt-3 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <div className="flex-1">
                            <p className="font-semibold text-slate-800 dark:text-white">{scanResult.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-3">
                                <span className="font-mono">{scanResult.code}</span>
                                <span>{scanResult.uom}</span>
                                {scanResult.barcode && <span className="font-mono text-indigo-500">{scanResult.barcode}</span>}
                            </p>
                        </div>
                        <button onClick={() => setScanResult(null)} className="text-slate-300 hover:text-slate-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {scanNotFound && (
                    <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-sm text-rose-600 dark:text-rose-400">
                        No item found for "{scannerInput}"
                    </div>
                )}
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filter items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button
                    onClick={selectAll}
                    className="text-xs text-indigo-600 hover:underline"
                >
                    {selectedItems.size === filteredItems.filter(i => i.barcode).length ? 'Deselect All' : 'Select All with Barcode'}
                </button>
            </div>

            {/* Items Table */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Loading items...</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                            <tr>
                                <th className="px-4 py-3 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.size > 0 && selectedItems.size === filteredItems.filter(i => i.barcode).length}
                                        onChange={selectAll}
                                        className="rounded border-slate-300 text-indigo-600"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase">Item</th>
                                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase">LAT Code</th>
                                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase">Category</th>
                                <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium uppercase">Barcode</th>
                                <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium uppercase w-28">Preview</th>
                                <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium uppercase w-24">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                            disabled={!item.barcode}
                                            className="rounded border-slate-300 text-indigo-600 disabled:opacity-30"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium text-slate-800 dark:text-white">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.code}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{item.category || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        {item.barcode ? (
                                            <span className="font-mono text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-1 rounded">
                                                {item.barcode}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300 italic">No barcode</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.barcode && (
                                            <BarcodePreview data={item.barcode} />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {!item.barcode && (
                                            <button
                                                onClick={() => autoGenerateBarcode(item.id)}
                                                className="text-xs text-violet-600 hover:text-violet-700 font-medium hover:underline"
                                            >
                                                Generate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No items found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// Mini barcode preview inline
const BarcodePreview: React.FC<{ data: string }> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && data) {
            drawBarcode(canvasRef.current, data, 120, 32);
        }
    }, [data]);

    return <canvas ref={canvasRef} className="w-[120px] h-[48px] mx-auto" />;
};
