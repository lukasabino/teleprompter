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

type DiagnosticsState = {
  gamepadName: string;
  gamepadConnected: boolean;
  lastKeyboardInput: string;
  lastGamepadInput: string;
  lastAction: string;
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
const SPEED_STEP = 10;
const MIN_SPEED = 10;
const MAX_SPEED = 240;

const BUTTON_LABELS: Record<number, string> = {
  0: 'Botao 0 / A',
  1: 'Botao 1 / B',
  2: 'Botao 2 / X',
  4: 'Botao 4 / LB',
  5: 'Botao 5 / RB',
  9: 'Botao 9 / Start',
  12: 'D-pad cima',
  13: 'D-pad baixo',
};

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    gamepadName: 'Nenhum controle detectado',
    gamepadConnected: false,
    lastKeyboardInput: 'Nenhuma tecla detectada',
    lastGamepadInput: 'Nenhum comando detectado',
    lastAction: 'Aguardando entrada',
  });
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    scrollOffset: 0,
  });

  const frameRef = useRef<number | null>(null);
  const gamepadFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousButtonsRef = useRef<Record<number, boolean>>({});
  const previousAxisRef = useRef<number>(0);
  const appShellRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === appShellRef.current);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  const playLabel = playback.isPlaying ? (playback.isPaused ? 'Retomar' : 'Pausar') : 'Play';
  const opacityValue = settings.opacity / 100;
  const orientationTransform = settings.mirrorMode === 'horizontal-mirror' ? 'scaleX(-1)' : 'rotate(180deg)';
  const floatingPlayLabel = playback.isPlaying ? (playback.isPaused ? 'Retomar' : 'Pausar') : 'Play';

  function updateSettings(partial: Partial<TeleprompterSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function updateSpeed(delta: number) {
    setSettings((current) => ({
      ...current,
      speed: clamp(current.speed + delta, MIN_SPEED, MAX_SPEED),
    }));
  }

  function recordAction(source: 'keyboard' | 'gamepad', input: string, action: string) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setDiagnostics((current) => ({
      ...current,
      lastKeyboardInput: source === 'keyboard' ? `${input} (${timestamp})` : current.lastKeyboardInput,
      lastGamepadInput: source === 'gamepad' ? `${input} (${timestamp})` : current.lastGamepadInput,
      lastAction: `${action} (${timestamp})`,
    }));
  }

  function nudgeScroll(delta: number) {
    const maxOffset = getMaxOffset(viewportRef.current, contentRef.current);

    setPlayback((current) => ({
      ...current,
      scrollOffset: clamp(current.scrollOffset + delta, 0, maxOffset),
    }));
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
    nudgeScroll(MANUAL_SCROLL_STEP);
  }

  function handleMoveTextDown() {
    nudgeScroll(-MANUAL_SCROLL_STEP);
  }

  async function handleFullscreenToggle() {
    const appShell = appShellRef.current;

    if (!appShell) {
      return;
    }

    if (document.fullscreenElement === appShell) {
      await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      await appShell.requestFullscreen();
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (isEditableTarget) {
        return;
      }

      let action = '';

      switch (event.code) {
        case 'Space':
        case 'Enter':
        case 'KeyK':
          event.preventDefault();
          handlePlayToggle();
          action = playback.isPlaying && !playback.isPaused ? 'Pausar/Reproduzir' : 'Iniciar/Reproduzir';
          break;
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          handleMoveTextUp();
          action = 'Subir texto';
          break;
        case 'ArrowDown':
        case 'PageDown':
          event.preventDefault();
          handleMoveTextDown();
          action = 'Descer texto';
          break;
        case 'Equal':
        case 'NumpadAdd':
        case 'BracketRight':
          event.preventDefault();
          updateSpeed(SPEED_STEP);
          action = 'Aumentar velocidade';
          break;
        case 'Minus':
        case 'NumpadSubtract':
        case 'BracketLeft':
          event.preventDefault();
          updateSpeed(-SPEED_STEP);
          action = 'Diminuir velocidade';
          break;
        case 'KeyR':
          event.preventDefault();
          handleRestart();
          action = 'Reiniciar';
          break;
        case 'Escape':
          event.preventDefault();
          handleStop();
          action = 'Parar';
          break;
        default:
          break;
      }

      if (action) {
        recordAction('keyboard', `${event.code}${event.key ? ` (${event.key})` : ''}`, action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playback.isPaused, playback.isPlaying]);

  useEffect(() => {
    const updateConnectedGamepad = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      const activeGamepad = gamepads.find((gamepad) => gamepad !== null) ?? null;

      setDiagnostics((current) => ({
        ...current,
        gamepadConnected: activeGamepad !== null,
        gamepadName: activeGamepad ? activeGamepad.id : 'Nenhum controle detectado',
      }));
    };

    const runGamepadAction = (input: string, action: string, callback: () => void) => {
      callback();
      recordAction('gamepad', input, action);
    };

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      const activeGamepad = gamepads.find((gamepad) => gamepad !== null) ?? null;

      if (activeGamepad) {
        setDiagnostics((current) => ({
          ...current,
          gamepadConnected: true,
          gamepadName: activeGamepad.id,
        }));

        activeGamepad.buttons.forEach((button, index) => {
          const wasPressed = previousButtonsRef.current[index] ?? false;
          const isPressed = button.pressed;

          if (isPressed && !wasPressed) {
            switch (index) {
              case 0:
              case 9:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Play/Pausa', handlePlayToggle);
                break;
              case 1:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Parar', handleStop);
                break;
              case 2:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Reiniciar', handleRestart);
                break;
              case 4:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Diminuir velocidade', () =>
                  updateSpeed(-SPEED_STEP),
                );
                break;
              case 5:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Aumentar velocidade', () =>
                  updateSpeed(SPEED_STEP),
                );
                break;
              case 12:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Subir texto', handleMoveTextUp);
                break;
              case 13:
                runGamepadAction(BUTTON_LABELS[index] ?? `Botao ${index}`, 'Descer texto', handleMoveTextDown);
                break;
              default:
                setDiagnostics((current) => ({
                  ...current,
                  lastGamepadInput: `Botao ${index} (${new Date().toLocaleTimeString('pt-BR')})`,
                }));
                break;
            }
          }

          previousButtonsRef.current[index] = isPressed;
        });

        const verticalAxis = activeGamepad.axes[1] ?? 0;
        const axisDirection = verticalAxis > 0.65 ? 1 : verticalAxis < -0.65 ? -1 : 0;

        if (axisDirection !== 0 && axisDirection !== previousAxisRef.current) {
          if (axisDirection < 0) {
            runGamepadAction('Analógico para cima', 'Subir texto', handleMoveTextUp);
          } else {
            runGamepadAction('Analógico para baixo', 'Descer texto', handleMoveTextDown);
          }
        }

        previousAxisRef.current = axisDirection;
      } else {
        previousButtonsRef.current = {};
        previousAxisRef.current = 0;
      }

      gamepadFrameRef.current = window.requestAnimationFrame(pollGamepads);
    };

    const handleGamepadConnected = () => updateConnectedGamepad();
    const handleGamepadDisconnected = () => updateConnectedGamepad();

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    updateConnectedGamepad();
    gamepadFrameRef.current = window.requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);

      if (gamepadFrameRef.current !== null) {
        cancelAnimationFrame(gamepadFrameRef.current);
        gamepadFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${playback.isPlaying ? 'is-playback' : ''} ${!isMenuVisible ? 'menu-hidden' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}
    >
      <aside className={`control-panel ${!isMenuVisible ? 'is-hidden' : ''}`}>
        <div className="mobile-menu-header">
          <span>Controles</span>
          <button className="menu-toggle" type="button" onClick={() => setIsMenuVisible(false)}>
            Fechar menu
          </button>
        </div>

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
          <button type="button" onClick={() => void handleFullscreenToggle()}>
            {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
          <button type="button" onClick={handleMoveTextUp}>
            Subir texto
          </button>
          <button type="button" onClick={handleMoveTextDown}>
            Descer texto
          </button>
          <button type="button" onClick={handleRestart}>
            Reiniciar
          </button>
          <button type="button" onClick={handleStop}>
            Parar
          </button>
        </div>

        <section className="diagnostics-panel">
          <div className="diagnostics-header">
            <h2>Controle externo</h2>
            <span className={diagnostics.gamepadConnected ? 'status-pill is-online' : 'status-pill'}>
              {diagnostics.gamepadConnected ? 'Gamepad conectado' : 'Sem gamepad'}
            </span>
          </div>

          <p className="diagnostics-copy">
            Atalhos de teclado: `Space/Enter/K` play ou pausa, `setas` sobem ou descem o texto, `+/-` ajustam
            velocidade, `R` reinicia e `Esc` para.
          </p>

          <div className="diagnostics-grid">
            <div className="diagnostics-item">
              <strong>Dispositivo</strong>
              <span>{diagnostics.gamepadName}</span>
            </div>
            <div className="diagnostics-item">
              <strong>Ultima tecla</strong>
              <span>{diagnostics.lastKeyboardInput}</span>
            </div>
            <div className="diagnostics-item">
              <strong>Ultimo comando do controle</strong>
              <span>{diagnostics.lastGamepadInput}</span>
            </div>
            <div className="diagnostics-item">
              <strong>Ultima acao executada</strong>
              <span>{diagnostics.lastAction}</span>
            </div>
          </div>
        </section>
      </aside>

      <main className="stage-panel">
        <div className="stage-toolbar">
          <div className="stage-toolbar-actions">
            <button className="menu-toggle" type="button" onClick={() => setIsMenuVisible((current) => !current)}>
              {isMenuVisible ? 'Ocultar menu' : 'Mostrar menu'}
            </button>
            <button className="menu-toggle" type="button" onClick={() => void handleFullscreenToggle()}>
              {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </button>
          </div>
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

        {!isMenuVisible ? (
          <div className="floating-transport">
            <button className="primary" type="button" onClick={handlePlayToggle}>
              {floatingPlayLabel}
            </button>
            <button type="button" onClick={handleRestart}>
              Reiniciar
            </button>
            <button type="button" onClick={handleMoveTextUp}>
              Subir texto
            </button>
            <button type="button" onClick={handleMoveTextDown}>
              Descer texto
            </button>
          </div>
        ) : null}
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default App;
