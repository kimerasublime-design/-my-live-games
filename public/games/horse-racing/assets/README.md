# Sprites V4 — cinco cavalos

O renderer carrega oito quadros PNG transparentes por cavalo a partir destes caminhos:

- `assets/horses/horse-01/frame-01.png` … `frame-08.png`
- `assets/horses/horse-02/frame-01.png` … `frame-08.png`
- `assets/horses/horse-03/frame-01.png` … `frame-08.png`
- `assets/horses/horse-04/frame-01.png` … `frame-08.png`
- `assets/horses/horse-05/frame-01.png` … `frame-08.png`

Formato esperado: PNG RGBA, 320 × 256 px. O intervalo inicial de animação é 110 ms por quadro e deverá ser ajustado após teste no overlay.

Copie a pasta `horses/` do pacote de sprites V4 para este diretório `assets/`. O jogo mantém fallback visual temporário até os arquivos PNG estarem presentes.
