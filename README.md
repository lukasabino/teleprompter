# Teleprompter

Aplicação web local para uso como monitor de texto em teleprompter, com editor embutido, personalização visual e rolagem contínua ajustável durante a leitura.

## Destaques

- Inserção de texto por digitação ou colagem
- Seleção de fonte com catálogo curado baseado em Google Fonts
- Ajuste de peso, tamanho e opacidade do texto
- Controle de velocidade antes e durante a execução
- Modos de inversão: espelhado horizontal e de cabeça para baixo
- Controles de `play`, `pausa`, `reinício`, `parar` e subida manual do texto
- Persistência local de texto e preferências via `localStorage`
- Interface responsiva para operação em navegador

## Preview de uso

O fluxo foi pensado para operar em uma única tela:

1. Cole ou digite o roteiro.
2. Ajuste fonte, tamanho, opacidade, peso e velocidade.
3. Escolha o tipo de inversão conforme a montagem do teleprompter.
4. Inicie o `Play` e ajuste a velocidade em tempo real se necessário.

## Stack

- React
- TypeScript
- Vite

## Como rodar

### Pré-requisitos

- Node.js 20+
- npm 10+

### Desenvolvimento

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite no navegador.

### Build de produção

```bash
npm run build
```

Os arquivos finais serão gerados em `dist/`.

## Estrutura principal

```text
src/
  App.tsx        # lógica da interface, estado e rolagem do teleprompter
  main.tsx       # bootstrap React
  styles.css     # layout e estilos da aplicação
PLAN.md          # plano de implementação usado no projeto
```

## Funcionalidades atuais

- Editor de texto integrado
- Painel de configuração visual
- Área de preview/leitura com rolagem automática
- Ajuste dinâmico de velocidade durante o play
- Persistência local de conteúdo e preferências
- Tela sem scroll da página

## Próximos refinamentos possíveis

- Atalhos de teclado para operação durante a leitura
- Modo fullscreen dedicado
- Controles mais discretos no modo play
- Importação e exportação de roteiros
- Presets de layout para diferentes distâncias de leitura

## Licença

Distribuído sob a licença `Apache-2.0`. Veja [LICENSE](/Users/lukasabino/code/teleprompter/LICENSE).
