import { useTheme, THEMES } from '@/contexts/ThemeContext'

export default function ThemePicker({ onSelect }: { onSelect?: (name: string) => void } = {}) {
  const { theme, themeName, isAuto, setThemeByName, setAuto } = useTheme()
  return (
    <div className="space-y-3">
      {/* Auto toggle */}
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <span className="text-sm font-semibold text-text">Follow system preference</span>
          <p className="text-xs text-text2">Automatically switches between Default (light) and Dark based on OS setting.</p>
        </div>
        <button
          role="switch"
          aria-checked={isAuto}
          onClick={() => setAuto(!isAuto)}
          className="relative w-10 h-6 rounded-full transition-colors shrink-0"
          style={{ background: isAuto ? theme.accent : theme.border }}
        >
          <span
            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: isAuto ? 'translateX(20px)' : 'translateX(4px)' }}
          />
        </button>
      </label>

      {/* Theme grid */}
      {!isAuto && (
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map(t => {
            const isActive = !isAuto && t.name === themeName
            return (
              <button
                key={t.name}
                onClick={() => { setThemeByName(t.name); onSelect?.(t.name) }}
                className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all"
                style={{
                  border: isActive ? `2px solid ${theme.accent}` : `2px solid transparent`,
                  background: isActive ? `${theme.accent}12` : 'transparent',
                }}
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden flex">
                  {t.previewColors?.map((c, i) => (
                    <div key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-text2">{t.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
