interface DesignTabProps {
  themeColor: string;
  setThemeColor: (color: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  backgroundTheme: string;
  setBackgroundTheme: (bg: string) => void;
}

export default function DesignTab({
  themeColor,
  setThemeColor,
  logoUrl,
  setLogoUrl,
  theme,
  setTheme,
  fontFamily,
  setFontFamily,
  backgroundTheme,
  setBackgroundTheme,
}: DesignTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🎨</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Appearance & Branding</h2>
            <p className="text-sm text-gray-500">Customize the visual style</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="label">Brand Color</label>
            <div className="flex gap-3 items-center">
              <div className="relative">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-12 w-12 rounded-xl border-2 border-gray-200 p-0 cursor-pointer overflow-hidden shadow-sm"
                />
                <div 
                  className="absolute inset-0 rounded-xl border-2 border-gray-300 pointer-events-none"
                  style={{ borderColor: themeColor }}
                ></div>
              </div>
              <input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="flex-1 input font-mono text-sm uppercase"
                placeholder="#111827"
              />
            </div>
          </div>
          <div>
            <label className="label">Logo URL</label>
            <div className="relative">
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="input pl-10"
                placeholder="https://yoursite.com/logo.png"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🖼️</span>
            </div>
            {logoUrl && (
              <div className="mt-3 flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-2 shadow-sm">
                  <img src={logoUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Logo Preview</p>
                  <p className="text-xs text-gray-500">This will appear on the survey header</p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Theme Style</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="input"
              >
                <option value="default">🎯 Modern</option>
                <option value="warm">🌅 Warm</option>
                <option value="cool">❄️ Cool</option>
                <option value="forest">🌲 Forest</option>
                <option value="dark">🌙 Dark</option>
              </select>
            </div>
            <div>
              <label className="label">Font</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="input"
              >
                <option value="default">System</option>
                <option value="serif">Serif</option>
                <option value="sans">Sans-serif</option>
                <option value="mono">Monospace</option>
                <option value="rounded">Rounded</option>
                <option value="elegant">Elegant</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Background</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: 'default', icon: '⬜', label: 'Plain' },
                { value: 'ocean', icon: '🌊', label: 'Ocean' },
                { value: 'sunset', icon: '🌅', label: 'Sunset' },
                { value: 'forest', icon: '🌲', label: 'Forest' },
                { value: 'galaxy', icon: '🌌', label: 'Galaxy' },
                { value: 'geometric', icon: '🔷', label: 'Geometric' },
                { value: 'dots', icon: '⚪', label: 'Dots' },
                { value: 'waves', icon: '〰️', label: 'Waves' },
                { value: 'mesh', icon: '🕸️', label: 'Mesh' },
              ].map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => setBackgroundTheme(bg.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                    backgroundTheme === bg.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <span className="text-lg">{bg.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
