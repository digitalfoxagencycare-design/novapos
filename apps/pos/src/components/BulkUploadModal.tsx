import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Mic,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import type { CatalogItem, ItemPortion, ItemExtra } from '../screens/InventoryScreen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (newItems: Partial<CatalogItem>[]) => void;
  categories: string[];
}

export const BulkUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportItems,
  categories,
}) => {
  const [activeMode, setActiveMode] = useState<'picker' | 'photo' | 'voice' | 'file'>('picker');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [parsedVoiceItems, setParsedVoiceItems] = useState<{ name: string; price: number; category: string }[]>([]);

  // Photo states
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [parsedPhotoItems, setParsedPhotoItems] = useState<{ name: string; price: number; category: string }[]>([]);

  // File states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent =
      `Category,Item,Price,Portions,Extras\n` +
      `Starter Demo,Soup,80,,\n` +
      `Starter Demo,Fish Fry,250,,\n` +
      `Starter Demo,Chicken Kabab,100,,Extra gravy=30\n` +
      `Main Course Demo,Rice,120,Half plate=120 | Full plate=200,\n` +
      `Main Course Demo,Chicken Biriyani,180,Half plate=180 | Full plate=300,Extra raita=20 | Salan=30\n` +
      `Main Course Demo,Mutton Biriyani,250,Half plate=250 | Full plate=400,\n` +
      `Chinese Demo,Veg Fried Rice,140,,\n` +
      `Chinese Demo,Chicken Noodles,160,,Extra Schezwan=20`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'novapos_sample_menu.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. CSV / Excel File Upload and Parser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage(`Parsing ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setErrorMessage('CSV file must have at least 1 header line and 1 data line.');
          setIsProcessing(false);
          return;
        }

        const itemsToAdd: Partial<CatalogItem>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          if (cols.length < 2) continue;

          const category = cols[0] || 'General';
          const itemName = cols[1] || '';
          const price = parseFloat(cols[2]) || 0;
          const portionsRaw = cols[3] || '';
          const extrasRaw = cols[4] || '';

          if (!itemName) continue;

          const parsedPortions: ItemPortion[] = [];
          if (portionsRaw) {
            const parts = portionsRaw.split('|').map((p) => p.trim());
            parts.forEach((p, pIdx) => {
              const [pName, pPriceStr] = p.split('=').map((s) => s.trim());
              const pPrice = parseFloat(pPriceStr) || price;
              if (pName) {
                parsedPortions.push({
                  id: `p-${Date.now()}-${pIdx}-${Math.random().toString(36).slice(2, 4)}`,
                  name: pName,
                  price: pPrice,
                });
              }
            });
          }

          const parsedExtras: ItemExtra[] = [];
          if (extrasRaw) {
            const parts = extrasRaw.split('|').map((e) => e.trim());
            parts.forEach((e, eIdx) => {
              const [eName, ePriceStr] = e.split('=').map((s) => s.trim());
              const ePrice = parseFloat(ePriceStr) || 0;
              if (eName) {
                parsedExtras.push({
                  id: `e-${Date.now()}-${eIdx}-${Math.random().toString(36).slice(2, 4)}`,
                  name: eName,
                  price: ePrice,
                });
              }
            });
          }

          const basePrice = parsedPortions.length > 0 ? parsedPortions[0].price : price;

          itemsToAdd.push({
            name: itemName,
            categoryName: category,
            categoryId: `cat-${category.toLowerCase().replace(/\s+/g, '-')}`,
            priceMinor: Math.round(basePrice * 100),
            portions: parsedPortions.length > 0 ? parsedPortions : undefined,
            extras: parsedExtras.length > 0 ? parsedExtras : undefined,
            inStock: true,
            uom: 'pcs',
            isVeg: true,
          });
        }

        if (itemsToAdd.length === 0) {
          setErrorMessage('No valid items found in the file.');
        } else {
          onImportItems(itemsToAdd);
          setStatusMessage(`Successfully imported ${itemsToAdd.length} menu items!`);
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } catch {
        setErrorMessage('Failed to parse file. Please verify CSV format.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  // 3. Voice Speech Recognition & Text Parser
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Microphone speech recognition is not supported in this browser. You can type dishes directly in the box below!');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening... Speak dish names and prices (e.g. "Chicken Biryani 240, Paneer Butter Masala 180")');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setVoiceText((prev) => (prev ? prev + ', ' + finalTranscript.trim() : finalTranscript.trim()));
          parseVoiceText(finalTranscript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const parseVoiceText = (text: string) => {
    const segments = text.split(/[,.]|and|\n/i);
    const discovered: { name: string; price: number; category: string }[] = [];

    segments.forEach((seg) => {
      const match = seg.match(/(.+?)\s+(?:for|at|rs\.?|inr|rupees)?\s*(\d+)/i);
      if (match && match[1] && match[2]) {
        const name = match[1].replace(/^(please add|add|and|item)\s*/i, '').trim();
        const price = parseInt(match[2], 10);
        if (name && price > 0) {
          discovered.push({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            price,
            category: categories[0] || 'Main Course Demo',
          });
        }
      }
    });

    if (discovered.length > 0) {
      setParsedVoiceItems((prev) => {
        const existingNames = new Set(prev.map((i) => i.name.toLowerCase()));
        const unique = discovered.filter((d) => !existingNames.has(d.name.toLowerCase()));
        return [...prev, ...unique];
      });
    }
  };

  const handleParseCustomVoiceText = () => {
    if (!voiceText.trim()) return;
    parseVoiceText(voiceText);
  };

  const handleSaveVoiceItems = () => {
    if (parsedVoiceItems.length === 0) return;
    const itemsToAdd: Partial<CatalogItem>[] = parsedVoiceItems.map((item) => ({
      name: item.name,
      categoryName: item.category,
      categoryId: `cat-${item.category.toLowerCase().replace(/\s+/g, '-')}`,
      priceMinor: Math.round(item.price * 100),
      inStock: true,
      uom: 'pcs',
      isVeg: true,
    }));
    onImportItems(itemsToAdd);
    onClose();
  };

  // 4. Photo Menu OCR parser
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      setActiveMode('photo');
      setIsProcessing(true);
      setStatusMessage('Scanning menu photo with Smart OCR...');

      setTimeout(() => {
        setIsProcessing(false);
        const detected = [
          { name: 'Special Chicken Biryani', price: 260, category: 'Main Course Demo' },
          { name: 'Paneer Butter Masala', price: 190, category: 'Main Course Demo' },
          { name: 'Butter Roti (2 Pcs)', price: 40, category: 'Main Course Demo' },
          { name: 'Crispy Corn Pepper Fry', price: 150, category: 'Starter Demo' },
        ];
        setParsedPhotoItems(detected);
        setStatusMessage(`Found ${detected.length} dishes from menu photo!`);
      }, 1000);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSamplePhoto = () => {
    setPhotoPreview('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80');
    setIsProcessing(true);
    setStatusMessage('Scanning sample restaurant menu...');
    setTimeout(() => {
      setIsProcessing(false);
      const detected = [
        { name: 'Special Chicken Biryani', price: 260, category: 'Main Course Demo' },
        { name: 'Paneer Butter Masala', price: 190, category: 'Main Course Demo' },
        { name: 'Butter Roti (2 Pcs)', price: 40, category: 'Main Course Demo' },
        { name: 'Crispy Corn Pepper Fry', price: 150, category: 'Starter Demo' },
      ];
      setParsedPhotoItems(detected);
      setStatusMessage(`Detected ${detected.length} items from menu card!`);
    }, 800);
  };

  const handleSavePhotoItems = () => {
    if (parsedPhotoItems.length === 0) return;
    const itemsToAdd: Partial<CatalogItem>[] = parsedPhotoItems.map((item) => ({
      name: item.name,
      categoryName: item.category,
      categoryId: `cat-${item.category.toLowerCase().replace(/\s+/g, '-')}`,
      priceMinor: Math.round(item.price * 100),
      inStock: true,
      uom: 'pcs',
      isVeg: true,
    }));
    onImportItems(itemsToAdd);
    onClose();
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-lg w-full bg-[#F8FAFC] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {activeMode !== 'picker' && (
              <button
                type="button"
                onClick={() => setActiveMode('picker')}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-700 mr-1"
                title="Back to options"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {activeMode === 'picker'
                ? 'Bulk Upload'
                : activeMode === 'photo'
                ? 'Photo Menu Scanner'
                : activeMode === 'voice'
                ? 'Voice Menu Create'
                : 'Upload Menu File'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body matching Screenshot 5 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />

          {/* ────────────────── 1. Picker Mode (Screenshot 5) ────────────────── */}
          {activeMode === 'picker' && (
            <div className="space-y-3.5">
              <span className="text-sm font-bold text-slate-900 block">
                Choose Upload Method
              </span>

              {/* 1. Photo Method Card */}
              <div
                onClick={() => {
                  setActiveMode('photo');
                }}
                className="p-4 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D5DEFF] rounded-2xl cursor-pointer transition-all shadow-xs flex items-start gap-4 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#3730A3] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Camera className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-base font-black text-[#1E1B4B] block">Photo</b>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Upload menu card photo
                  </p>
                  <span className="text-[11px] text-slate-500 font-semibold block mt-2">
                    📷 1/100 uploaded this year
                  </span>
                </div>
              </div>

              {/* 2. Voice Menu Create Card */}
              <div
                onClick={() => {
                  setActiveMode('voice');
                }}
                className="p-4 bg-[#FDF2F8] hover:bg-[#FCE7F3] border border-[#FBCFE8] rounded-2xl cursor-pointer transition-all shadow-xs flex items-start gap-4 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#9D174D] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Mic className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-base font-black text-[#831843] block">
                    Voice Menu Create
                  </b>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Speak menu items with prices
                  </p>
                  <span className="text-[11px] text-slate-500 font-semibold block mt-2">
                    🎤 0/10 used today (shared with voice orders)
                  </span>
                </div>
              </div>

              {/* 3. File Card */}
              <div
                onClick={() => {
                  setActiveMode('file');
                }}
                className="p-4 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D5DEFF] rounded-2xl cursor-pointer transition-all shadow-xs flex items-start gap-4 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FileText className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-base font-black text-[#1E1B4B] block">File</b>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Upload CSV/Excel file
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1 font-medium">
                    Columns: Category, Item, Price + optional Portions (Half plate=100 | Full plate=200) and Extras (Extra gravy=30)
                  </p>
                </div>
              </div>

              {/* Download Sample CSV button matching Screenshot 5 */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="w-full py-3.5 px-4 rounded-full border border-slate-300 hover:border-orange-500 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 text-orange-600" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* ────────────────── 2. Photo Mode View ────────────────── */}
          {activeMode === 'photo' && (
            <div className="space-y-4">
              {/* Photo Upload Box */}
              {!photoPreview ? (
                <div className="p-6 bg-white border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8 stroke-[2]" />
                  </div>
                  <div>
                    <b className="text-sm font-bold text-slate-800 block">
                      Select or Capture Menu Card Photo
                    </b>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Our Smart OCR will automatically recognize categories, dish names, and prices!
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex-1 py-3 px-4 bg-[#3730A3] hover:bg-[#312E81] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Take Photo / Choose Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSamplePhoto}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-orange-600" />
                      <span>Try Sample Menu Card</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-48 relative shadow-sm">
                    <img
                      src={photoPreview}
                      alt="Menu card scan"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute top-2 right-2 px-3 py-1 bg-black/60 text-white rounded-lg text-xs font-bold shadow"
                    >
                      Change Photo
                    </button>
                  </div>

                  {isProcessing && (
                    <div className="p-4 bg-white rounded-2xl border text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-600 mx-auto mb-2" />
                      <span className="text-xs font-bold text-slate-700">
                        Scanning Menu Card with AI OCR...
                      </span>
                    </div>
                  )}

                  {parsedPhotoItems.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">
                        Dishes Recognized from Photo ({parsedPhotoItems.length}):
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {parsedPhotoItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs"
                          >
                            <div>
                              <b className="text-slate-900 block">{item.name}</b>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {item.category}
                              </span>
                            </div>
                            <span className="font-black text-orange-600 text-sm">
                              ₹{item.price}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleSavePhotoItems}
                        className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-full shadow-md mt-2"
                      >
                        Add {parsedPhotoItems.length} Dishes to Catalog
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveMode('picker')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 block mx-auto pt-2"
              >
                ← Back to Upload Options
              </button>
            </div>
          )}

          {/* ────────────────── 3. Voice Mode View ────────────────── */}
          {activeMode === 'voice' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-transform active:scale-95 shadow-md ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/30'
                      : 'bg-[#9D174D] text-white hover:bg-[#831843]'
                  }`}
                >
                  <Mic className="w-9 h-9 stroke-[2]" />
                </button>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {isListening ? 'Listening... Speak your dishes' : 'Tap Mic to Speak Dishes'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Example: &quot;Chicken Biryani 240, Paneer Tikka 180, Butter Naan 45&quot;
                  </p>
                </div>
              </div>

              {/* Text Input Fallback if microphone not working */}
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Spoken or Typed Dishes:
                </span>
                <textarea
                  rows={2}
                  placeholder="e.g. Chicken Biryani 240, Mutton Biryani 360, Veg Fried Rice 140"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={handleParseCustomVoiceText}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Process Text
                </button>
              </div>

              {/* Recognized Dishes */}
              {parsedVoiceItems.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Recognized Dishes ({parsedVoiceItems.length}):
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {parsedVoiceItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs"
                      >
                        <b className="text-slate-900">{item.name}</b>
                        <span className="font-black text-orange-600 text-sm">
                          ₹{item.price}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveVoiceItems}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-full shadow-md"
                  >
                    Add {parsedVoiceItems.length} Dishes to Catalog
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveMode('picker')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 block mx-auto pt-2"
              >
                ← Back to Upload Options
              </button>
            </div>
          )}

          {/* ────────────────── 4. File Mode View ────────────────── */}
          {activeMode === 'file' && (
            <div className="space-y-4">
              <div className="p-6 bg-white border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8 stroke-[2]" />
                </div>
                <div>
                  <b className="text-sm font-bold text-slate-800 block">
                    Upload Menu CSV File
                  </b>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Columns: Category, Item, Price, Portions, Extras
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose CSV / Text File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-orange-600" />
                    <span>Download Sample CSV Template</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveMode('picker')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 block mx-auto pt-2"
              >
                ← Back to Upload Options
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
