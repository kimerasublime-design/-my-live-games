# Kimera Live Games 🎮

**Uma plataforma de jogos interativos para transmissões ao vivo.**

O Kimera Live Games conecta eventos de uma live do TikTok a jogos exibidos como overlay no OBS ou TikTok Studio. Quem está assistindo pode participar por meio de presentes, curtidas, compartilhamentos e mensagens no chat, conforme as regras de cada jogo.

## Recursos atuais

- **Várias transmissões isoladas:** cada streamer utiliza sua própria sala.
- **Integração com TikTok Live:** conexão por meio do `tiktok-live-connector`.
- **Bridge para jogos:** biblioteca cliente que encaminha eventos em tempo real.
- **Eventos normalizados:** formato consistente para chat, presentes, curtidas e compartilhamentos.
- **Reconexão automática:** tentativas com espera progressiva.
- **Overlays para OBS:** páginas de jogo com fundo transparente.
- **Depurador de eventos:** monitoramento para identificar os dados e nomes dos presentes.

## Jogo disponível

### 🏇 Corrida de Cavalos

Jogo em que os presentes impulsionam os cavalos de diferentes pistas. A configuração de pistas, presentes e valores fica em `public/games/horse-racing/config.js`.

O ciclo da partida inclui espera, contagem regressiva, corrida, resultado e intervalo. O jogo utiliza Canvas 2D e elementos HTML para exibir progresso, eventos e vencedor.

> A interface já está sendo adaptada para a identidade Kimera. A personalização das pistas e das regras será feita em uma próxima etapa.

## Como executar localmente

### Requisitos

- Node.js 18 ou superior
- npm

### Instalação

```bash
git clone https://github.com/kimerasublime-design/-my-live-games.git
cd -my-live-games
npm install
npm start
```

Abra o painel em http://localhost:3000.

1. Informe o nome de usuário do TikTok que está ao vivo, sem o símbolo `@`.
2. Selecione um jogo disponível.
3. Gere o link do overlay.
4. Adicione o link ao OBS ou TikTok Studio como uma fonte de navegador.

O usuário informado precisa estar transmitindo ao vivo para que a conexão seja estabelecida.

## Depurador

Acesse http://localhost:3000/debug.html para acompanhar os eventos recebidos em tempo real e conferir os dados dos presentes.

## Estrutura do projeto

```
src/
  server.js
  services/
    TikTokService.js
  lib/
    tiktokEventNormalizer.js
    tiktokReconnectPolicy.js
public/
  index.html
  debug.html
  css/styles.css
  js/dashboard.js
  lib/tiktok-bridge.js
  games/
    horse-racing/
```

## Arquitetura

```
TikTok Live
  → tiktok-live-connector
  → TikTokService
  → salas Socket.io
  → tiktok-bridge.js
  → jogo/overlay
```

Cada streamer recebe uma sala identificada pelo nome de usuário. Os eventos são encaminhados aos clientes conectados à sala correspondente.

## API

### Endpoints HTTP

| Rota | Método | Finalidade |
| --- | --- | --- |
| `/api/health` | GET | Estado do servidor |
| `/api/stats` | GET | Estatísticas das conexões |

### Eventos Socket.io

**Cliente → servidor:** `join-room`, `leave-room`.

**Servidor → cliente:** `tiktok_connected`, `tiktok_chat`, `tiktok_gift`, `tiktok_like`, `tiktok_share`, `tiktok_reconnecting`, `tiktok_disconnected` e `tiktok_error`.

Todos os eventos incluem um registro de tempo. Os dados exatos podem ser inspecionados pelo depurador.

## Adicionar um jogo

1. Crie uma pasta em `public/games/NOME-DO-JOGO/`.
2. Crie o HTML do overlay.
3. Inclua Socket.io e `/lib/tiktok-bridge.js`.
4. Escute os eventos necessários com `TikTokBridge.on("gift", callback)`, `TikTokBridge.on("chat", callback)` e outros eventos disponíveis.
5. Registre o jogo no painel.

## Desenvolvimento

```bash
npm run dev   # reinicia automaticamente durante o desenvolvimento
npm start     # inicia o servidor
```

## Tecnologias

- Node.js 18+ e ES Modules
- Express
- Socket.io
- tiktok-live-connector
- JavaScript, Canvas 2D e CSS

A porta padrão é 3000. É possível definir outra porta pela variável de ambiente `PORT`.

## Sobre o projeto

Kimera Live Games é uma personalização independente baseada no fork deste projeto. A integração com TikTok depende de bibliotecas e serviços de terceiros e pode mudar conforme as plataformas atualizam suas APIs.

O `package.json` mantém a declaração de licença herdada do projeto-base. Confira os avisos de licença e atribuição do repositório original antes de redistribuir versões.
