import React, { useState } from 'react';
import { Search, Star, Play, Sparkles, BookOpen, Trash2, Edit3, Tag, UserCheck, Plus } from 'lucide-react';
import { Script } from '../types';

interface ArchiveViewProps {
  scripts: Script[];
  onSelectScript: (script: Script) => void;
  onSelectScriptForRehearsal: (script: Script) => void;
  onSelectScriptForAnalysis: (script: Script) => void;
  onToggleFavorite: (scriptId: string) => void;
  onDeleteScript: (scriptId: string) => void;
  onOpenUpload: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  scripts,
  onSelectScript,
  onSelectScriptForRehearsal,
  onSelectScriptForAnalysis,
  onToggleFavorite,
  onDeleteScript,
  onOpenUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'preset' | 'custom'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const genres = ['all', 'Dram', 'Tragedya', 'Komedi', 'Monolog', 'Klasik'];

  const filteredScripts = scripts.filter((s) => {
    // Search match
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.characters.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    // Filter type match
    if (filterType === 'favorites' && !s.isFavorite) return false;
    if (filterType === 'preset' && !s.isPreset) return false;
    if (filterType === 'custom' && s.isPreset) return false;

    // Genre match
    if (selectedGenre !== 'all' && s.genre !== selectedGenre && !s.tags?.includes(selectedGenre)) return false;

    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Hero Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#18191E] border border-stone-800 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-stone-800 border border-stone-700 text-amber-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Aklımda Tiyatro & Dizi Replik Arşivi</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-100 tracking-tight font-serif">
            Prova Etmek İstediğin <span className="text-amber-300">Tiyatro Oyunu & Rolü Seç</span>
          </h2>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Klasik ve modern tiyatro metinleriyle hemen replik çalışmaya başlayabilir, favorilerine ekleyebilir veya kendi PDF oyun metnini yükleyerek temizleyebilirsin.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              id="upload-script-hero-btn"
              onClick={onOpenUpload}
              className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni PDF / Metin Yükle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#18191E] p-4 rounded-xl border border-stone-800 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            id="archive-search-input"
            type="text"
            placeholder="Oyun adı, yazar, karakter veya etikete göre ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111215] border border-stone-700 rounded-lg pl-10 pr-4 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/60 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#111215] p-1 rounded-lg border border-stone-800 flex items-center text-xs font-medium">
            <button
              id="filter-all-btn"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'all' ? 'bg-amber-600 text-stone-950 font-bold shadow-sm' : 'text-stone-300 hover:text-white'
              }`}
            >
              Tümü ({scripts.length})
            </button>
            <button
              id="filter-favorites-btn"
              onClick={() => setFilterType('favorites')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                filterType === 'favorites' ? 'bg-amber-600 text-stone-950 font-bold shadow-sm' : 'text-stone-300 hover:text-white'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Favoriler ({scripts.filter((s) => s.isFavorite).length})</span>
            </button>
            <button
              id="filter-preset-btn"
              onClick={() => setFilterType('preset')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'preset' ? 'bg-amber-600 text-stone-950 font-bold shadow-sm' : 'text-stone-300 hover:text-white'
              }`}
            >
              Hazır Metinler
            </button>
            <button
              id="filter-custom-btn"
              onClick={() => setFilterType('custom')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'custom' ? 'bg-amber-600 text-stone-950 font-bold shadow-sm' : 'text-stone-300 hover:text-white'
              }`}
            >
              Kaydettiklerim ({scripts.filter((s) => !s.isPreset).length})
            </button>
          </div>
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider flex items-center gap-1 mr-2">
          <Tag className="w-3 h-3 text-amber-500" /> Kategori:
        </span>
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              selectedGenre === genre
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                : 'bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-200'
            }`}
          >
            {genre === 'all' ? 'Tüm Türler' : genre}
          </button>
        ))}
      </div>

      {/* Script Grid */}
      {filteredScripts.length === 0 ? (
        <div className="text-center py-16 bg-[#18191E] rounded-2xl border border-stone-800 space-y-4">
          <BookOpen className="w-12 h-12 text-stone-600 mx-auto" />
          <p className="text-stone-300 font-medium text-lg">Aramanıza uygun metin bulunamadı.</p>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            Farklı bir arama terimi deneyebilir veya yeni bir oyun metnini PDF olarak yükleyebilirsiniz.
          </p>
          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-lg bg-amber-600 text-stone-950 font-bold text-xs hover:bg-amber-500 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Yeni Metin Yükle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScripts.map((script) => (
            <div
              key={script.id}
              className="group relative bg-[#18191E] rounded-xl border border-stone-800 hover:border-amber-500/40 transition-all duration-300 overflow-hidden flex flex-col shadow-sm"
            >
              {/* Card Top Banner / Cover */}
              <div className="relative h-32 bg-[#111215] overflow-hidden border-b border-stone-800">
                {script.coverImage ? (
                  <img
                    src={script.coverImage}
                    alt={script.title}
                    className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-[#111215] flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-amber-500/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#18191E] via-[#18191E]/40 to-transparent" />

                {/* Genre & Preset Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#111215]/90 backdrop-blur-md text-amber-300 border border-stone-700 text-[11px] font-medium">
                    {script.genre}
                  </span>
                  {script.isPreset && (
                    <span className="px-2 py-0.5 rounded-md bg-stone-800/90 text-stone-300 border border-stone-700 text-[10px] font-medium">
                      Hazır Oyun
                    </span>
                  )}
                </div>

                {/* Favorite Star Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(script.id);
                  }}
                  className={`absolute top-3 right-3 p-1.5 rounded-md backdrop-blur-md border transition-all ${
                    script.isFavorite
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-stone-800/80 border-stone-700 text-stone-400 hover:text-amber-400'
                  }`}
                  title={script.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                >
                  <Star className={`w-4 h-4 ${script.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-stone-100 line-clamp-1 group-hover:text-amber-300 transition-colors font-serif">
                    {script.title}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-medium">Yazar: {script.author}</p>
                  {script.description && (
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{script.description}</p>
                  )}
                </div>

                {/* Characters Pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-stone-400 font-medium">
                    <span className="flex items-center gap-1 text-amber-300">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" /> {script.characters.length} Karakter
                    </span>
                    <span className="text-stone-400">{script.lines.length} Replik</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {script.characters.slice(0, 4).map((char) => (
                      <span key={char} className="px-2 py-0.5 rounded-md bg-[#111215] text-stone-300 text-[10px] border border-stone-800">
                        {char}
                      </span>
                    ))}
                    {script.characters.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#111215] text-stone-400 text-[10px]">
                        +{script.characters.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectScriptForRehearsal(script)}
                    className="flex-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-stone-950" />
                    <span>Provaya Başla</span>
                  </button>

                  <button
                    onClick={() => onSelectScript(script)}
                    className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center justify-center transition-all border border-stone-700"
                    title="Metni İncele & Replikleri Düzenle"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSelectScriptForAnalysis(script)}
                    className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs flex items-center justify-center transition-all border border-stone-700"
                    title="AI ile Karakter Analizi"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteScript(script.id);
                    }}
                    className="p-2 rounded-lg bg-stone-800 hover:bg-red-950 text-red-400 text-xs flex items-center justify-center transition-all border border-stone-700 hover:border-red-800"
                    title="Metni Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
