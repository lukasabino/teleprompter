import { useEffect, useMemo, useRef, useState } from 'react';

type MirrorMode = 'horizontal-mirror' | 'upside-down';

type FontOption = {
  family: string;
  weights: number[];
};

type TeleprompterSettings = {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  opacity: number;
  speed: number;
  mirrorMode: MirrorMode;
};

type PlaybackState = {
  isPlaying: boolean;
  isPaused: boolean;
  scrollOffset: number;
};

const STORAGE_KEY = 'teleprompter-state-v1';

const DEFAULT_TEXT = `Cole ou digite seu roteiro aqui.

Use os controles para definir fonte, tamanho, opacidade e velocidade.

Ao iniciar o play, o texto entra em rolagem contínua e você pode ajustar a velocidade durante a leitura.`;

const FONT_OPTIONS: FontOption[] = [
  { family: 'Inter', weights: [400, 500, 600, 700] },
  { family: 'Roboto', weights: [400, 500, 700] },
  { family: 'Montserrat', weights: [400, 500, 600, 700] },
  { family: 'Poppins', weights: [400, 500, 600, 700] },
  { family: 'Merriweather', weights: [400, 700] },
  { family: 'Playfair Display', weights: [400, 600, 700] },
  { family: 'Lora', weights: [400, 500, 600, 700] },
  { family: 'Source Sans 3', weights: [400, 500, 600, 700] },
];

const DEFAULT_SETTINGS: TeleprompterSettings = {
  fontFamily: FONT_OPTIONS[0].family,
  fontWeight: FONT_OPTIONS[0].weights[1],
  fontSize: 72,
  opacity: 100,
  speed: 60,
  mirrorMode: 'horizontal-mirror',
};

const MANUAL_SCROLL_STEP = 160;

function loadInitialState(): {
  text: string;
  settings: TeleprompterSettings;
} {
  if (typeof window === 'undefined') {
    return { text: DEFAULT_TEXT, settings: DEFAULT_SETTINGS };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { text: DEFAULT_TEXT, settings: DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as {
      text?: string;
      settings?: Partial<TeleprompterSettings>;
    };

    return {
      text: parsed.text || DEFAULT_TEXT,
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
      },
    };
  } catch {
    return { text: DEFAULT_TEXT, settings: DEFAULT_SETTINGS };
  }
}

function buildGoogleFontsUrl(fonts: FontOption[]): string {
  const families = fonts
    .map((font) => {
      const family = font.family.replace(/ /g, '+');
      const weights = [...new Set(font.weights)].join(';');
      return `family=${family}:wght@${weights}`;
    })
    .join('&');

  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function App() {
  const initialState = useMemo(loadInitialState, []);
  const [text, setText] = useState(initialState.text);
  const [settings, setSettings] = useState<TeleprompterSettings>(initialState.settings);
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    scrollOffset: 0,
  });

  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const selectedFont = FONT_OPTIONS.find((font) => font.family === settings.fontFamily) ?? FONT_OPTIONS[0];

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = buildGoogleFontsUrl(FONT_OPTIONS);
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        text,
        settings,
      }),
    );
  }, [settings, text]);

  useEffect(() => {
    if (!playback.isPlaying || playback.isPaused) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      setPlayback((current) => {
        const nextOffset = current.scrollOffset + (settings.speed * elapsed) / 1000;
        const maxOffset = getMaxOffset(viewportRef.current, contentRef.current);

        if (nextOffset >= maxOffset) {
          return {
            isPlaying: false,
            isPaused: false,
            scrollOffset: maxOffset,
          };
        }

        return {
          ...current,
          scrollOffset: nextOffset,
        };
      });

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [playback.isPaused, playback.isPlaying, settings.speed, text]);

  useEffect(() => {
    if (!playback.isPlaying) {
      const maxOffset = getMaxOffset(viewportRef.current, contentRef.current);
      setPlayback((current) => ({
        ...current,
        scrollOffset: Math.min(current.scrollOffset, maxOffset),
      }));
    }
  }, [playback.isPlaying, settings.fontSize, text]);

  const playLabel = playback.isPlaying ? (playback.isPaused ? 'Retomar' : 'Pausar') : 'Play';
  const opacityValue = settings.opacity / 100;
  const orientationTransform = settings.mirrorMode === 'horizontal-mirror' ? 'scaleX(-1)' : 'rotate(180deg)';

  function updateSettings(partial: Partial<TeleprompterSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function handleFontChange(fontFamily: string) {
    const nextFont = FONT_OPTIONS.find((font) => font.family === fontFamily) ?? FONT_OPTIONS[0];
    updateSettings({
      fontFamily: nextFont.family,
      fontWeight: nextFont.weights.includes(settings.fontWeight) ? settings.fontWeight : nextFont.weights[0],
    });
  }

  function handlePlayToggle() {
    if (!playback.isPlaying) {
      setPlayback({
        isPlaying: true,
        isPaused: false,
        scrollOffset: 0,
      });
      return;
    }

    setPlayback((current) => ({
      ...current,
      isPaused: !current.isPaused,
    }));
  }

  function handleRestart() {
    setPlayback({
      isPlaying: true,
      isPaused: false,
      scrollOffset: 0,
    });
  }

  function handleStop() {
    setPlayback({
      isPlaying: false,
      isPaused: false,
      scrollOffset: 0,
    });
  }

  function handleMoveTextUp() {
    setPlayback((current) => ({
      ...current,
      scrollOffset: Math.max(current.scrollOffset - MANUAL_SCROLL_STEP, 0),
    }));
  }

  return (
    <div className={`app-shell ${playback.isPlaying ? 'is-playback' : ''} ${!isMenuVisible ? 'menu-hidden' : ''}`}>
      <aside className={`control-panel ${!isMenuVisible ? 'is-hidden' : ''}`}>
        <div className="panel-header">
          <p className="eyebrow">Teleprompter</p>
          <h1>Monitor de texto com rolagem ajustável</h1>
          <p className="panel-copy">
            Edite o roteiro, escolha a aparência do texto e inicie a leitura com espelhamento configurável.
          </p>
        </div>

        <label className="field field-textarea">
          <span>Texto</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cole ou digite o texto aqui"
          />
        </label>

        <div className="settings-grid">
          <label className="field">
            <span>Fonte</span>
            <select value={settings.fontFamily} onChange={(event) => handleFontChange(event.target.value)}>
              {FONT_OPTIONS.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.family}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Peso</span>
            <select
              value={settings.fontWeight}
              onChange={(event) => updateSettings({ fontWeight: Number(event.target.value) })}
            >
              {selectedFont.weights.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tamanho</span>
            <input
              type="range"
              min="32"
              max="160"
              step="2"
              value={settings.fontSize}
              onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
            />
            <strong>{settings.fontSize}px</strong>
          </label>

          <label className="field">
            <span>Opacidade</span>
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={settings.opacity}
              onChange={(event) => updateSettings({ opacity: Number(event.target.value) })}
            />
            <strong>{settings.opacity}%</strong>
          </label>

          <label className="field">
            <span>Velocidade</span>
            <input
              type="range"
              min="10"
              max="240"
              step="5"
              value={settings.speed}
              onChange={(event) => updateSettings({ speed: Number(event.target.value) })}
            />
            <strong>{settings.speed}px/s</strong>
          </label>

          <label className="field">
            <span>Inversão</span>
            <select
              value={settings.mirrorMode}
              onChange={(event) => updateSettings({ mirrorMode: event.target.value as MirrorMode })}
            >
              <option value="horizontal-mirror">Espelhado horizontal</option>
              <option value="upside-down">De cabeça para baixo</option>
            </select>
          </label>
        </div>

        <div className="transport">
          <button className="primary" type="button" onClick={handlePlayToggle}>
            {playLabel}
          </button>
          <button type="button" onClick={handleMoveTextUp}>
            Subir texto
          </button>
          <button type="button" onClick={handleRestart}>
            Reiniciar
          </button>
          <button type="button" onClick={handleStop}>
            Parar
          </button>
        </div>
      </aside>

      <main className="stage-panel">
        <div className="stage-toolbar">
          <button className="menu-toggle" type="button" onClick={() => setIsMenuVisible((current) => !current)}>
            {isMenuVisible ? 'Ocultar menu' : 'Mostrar menu'}
          </button>
          <span>{playback.isPlaying ? (playback.isPaused ? 'Pausado' : 'Em execução') : 'Pré-visualização'}</span>
          <span>{settings.speed}px/s</span>
        </div>

        <div ref={viewportRef} className="teleprompter-stage">
          <div className="teleprompter-orientation" style={{ transform: orientationTransform }}>
            <div
              ref={contentRef}
              className="teleprompter-copy"
              style={{
                fontFamily: `"${settings.fontFamily}", sans-serif`,
                fontSize: `${settings.fontSize}px`,
                fontWeight: settings.fontWeight,
                opacity: opacityValue,
                transform: `translateY(-${playback.scrollOffset}px)`,
              }}
            >
              {text.split('\n').map((line, index) => (
                <p key={`${line}-${index}`}>{line || '\u00A0'}</p>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getMaxOffset(viewport: HTMLDivElement | null, content: HTMLDivElement | null): number {
  if (!viewport || !content) {
    return 0;
  }

  return Math.max(content.scrollHeight - viewport.clientHeight + 64, 0);
}

export default App;
