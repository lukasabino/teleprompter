# Plano de Implementação: Aplicação Web de Teleprompter

## Resumo

Construir uma SPA web local, responsiva, com dois estados principais na mesma interface: `edição/configuração` e `play`. A tela inicial permitirá colar ou digitar o texto e ajustar fonte, tamanho, estilo, opacidade e velocidade. Ao acionar `Play`, o app entra em modo de leitura com rolagem automática e permite alterar a velocidade durante a execução sem reiniciar.

## Implementação

- Base técnica: iniciar o projeto como app web local com `Vite + React + TypeScript`, por ser a opção mais direta para uma UI interativa, leve e fácil de executar no navegador.
- Layout principal:
  - Painel de edição com área de texto grande para digitação/colar conteúdo.
  - Painel de controles com seleção de fonte, tamanho, estilo, opacidade, velocidade e tipo de inversão.
  - Botão `Play` para alternar para o modo leitura na mesma tela.
- Fontes:
  - Usar um catálogo fixo de fontes populares do Google Fonts na v1.
  - Carregar a fonte selecionada dinamicamente no app.
  - Expor no seletor nome legível e aplicar imediatamente no preview.
- Controles de estilo:
  - `Fonte`: lista curada do Google Fonts.
  - `Tamanho`: slider ou input numérico com atualização instantânea.
  - `Estilo`: no mínimo peso/variação visual legível para teleprompter.
  - `Opacidade`: controle aplicado ao texto no preview e no modo play.
  - `Velocidade`: controle contínuo que afeta a rolagem antes e durante a execução.
  - `Inversão`: alternância entre `espelhado horizontal` e `de cabeça para baixo`.
- Modo `Play`:
  - Renderizar o texto em área dedicada de leitura, ocupando o máximo possível da viewport.
  - Aplicar a transformação visual escolhida (`scaleX(-1)` para espelho horizontal ou rotação/inversão para montagem alternativa).
  - Iniciar/parar a rolagem por `requestAnimationFrame` ou loop temporal equivalente, usando velocidade ajustável em tempo real.
  - Manter controles mínimos visíveis ou sobrepostos para `pausar`, `retomar`, `reiniciar` e ajustar velocidade sem sair do modo play.
  - Reiniciar a posição do texto ao começar nova execução, com opção de pausar sem perder a posição atual.
- Persistência:
  - Salvar localmente no navegador o texto e as preferências com `localStorage`.
  - Restaurar automaticamente ao reabrir a aplicação.
- Estado e interfaces:
  - Definir um objeto central de configuração, por exemplo `TeleprompterSettings`, com campos para `fontFamily`, `fontSize`, `fontWeight/style`, `opacity`, `speed`, `mirrorMode`.
  - Separar estado de `conteúdo`, `configuração` e `playback` para evitar acoplamento entre edição e reprodução.

## Testes

- Renderização correta do texto digitado/colado no editor e no modo play.
- Aplicação imediata de fonte, tamanho, estilo e opacidade no preview.
- Troca do tipo de inversão entre os dois modos suportados.
- Início, pausa, retomada e reinício da rolagem.
- Alteração de velocidade durante a execução sem travar nem reiniciar a posição.
- Persistência de texto e preferências após recarregar a página.
- Comportamento responsivo em desktop e tablet/notebook em orientação horizontal.

## APIs e Tipos

- Tipo principal de configuração da UI e reprodução: `TeleprompterSettings`.
- Enum ou união literal para o modo de inversão: `horizontal-mirror | upside-down`.
- Estado de reprodução com pelo menos: `isPlaying`, `isPaused`, `scrollOffset`, `speed`.

## Premissas

- A v1 será uma aplicação web local, não um app desktop empacotado.
- O fluxo será na mesma tela, alternando entre configuração e leitura.
- O catálogo de fontes será curado/fixo na primeira versão, ainda baseado em Google Fonts.
- O app salvará texto e preferências localmente no navegador.
- O suporte inicial de inversão terá os dois comportamentos selecionáveis, porque isso foi definido como requisito funcional.
