export const brandIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#8ff3c0"/><path fill="#10251b" d="M7 17h4v8H7zm7-5h4v13h-4zm7-5h4v18h-4z"/></svg>';

export function home(github = 'https://github.com/benjaalbo888/stravapi') {
  return `<!doctype html>
<html lang="es" data-type="software">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="page-type" content="software">
  <meta name="site-kind" content="software">
  <meta name="description" content="Consulta productos, categorías y existencias ficticias con una API REST pública.">
  <meta name="theme-color" content="#0d1614">
  <meta property="og:title" content="StravAPI · Datos listos para construir.">
  <meta property="og:description" content="Catálogo ficticio para proyectos frontend, inventario y tiendas de demostración.">
  <meta property="og:type" content="website">
  <title>StravAPI · Datos listos para construir.</title>
  <link rel="icon" href="/assets/brand.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/stravapi.css">
  <script src="/assets/stravapi.js" defer></script>
</head>
<body>
  <a class="skip" href="#contenido">Saltar al contenido</a>
  <header class="masthead wrap">
    <a class="brand" href="/" aria-label="StravAPI, inicio"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>StravAPI</a>
    <nav aria-label="Navegación principal">
      <a href="/docs">Documentación</a>
      <a class="spec" href="/openapi.json">OpenAPI</a>
    </nav>
  </header>
  <main id="contenido" class="wrap" tabindex="-1">
    <section class="hero" data-enter aria-labelledby="titulo">
      <div class="intro">
        <h1 id="titulo">Datos listos<br>para construir<span>.</span></h1>
        <p>Consulta productos, categorías y existencias ficticias para tus proyectos. Los endpoints GET son públicos y no requieren registro.</p>
        <div class="actions">
          <a class="button primary" href="/docs">Explorar documentación <span aria-hidden="true">&rarr;</span></a>
          <a class="button secondary" href="${github}">Ver en GitHub</a>
        </div>
      </div>
      <div class="terminal" aria-label="Ejemplo de solicitud y respuesta">
        <div class="terminal-head"><span class="dot" aria-hidden="true"></span><span>Ejemplo de solicitud</span><button type="button" id="copy" hidden>Copiar</button></div>
        <div class="request">
          <pre><code id="command"><b>GET</b> /api/v1/stats</code></pre>
        </div>
        <div class="response">
          <div class="response-label"><span>Respuesta JSON</span><span class="http-status">200 OK</span></div>
          <pre><code>{
  <span class="key">"success"</span>: <span class="value">true</span>,
  <span class="key">"data"</span>: {
    <span class="key">"products"</span>: <span class="value">84</span>,
    <span class="key">"categories"</span>: <span class="value">6</span>,
    <span class="key">"lowStock"</span>: <span class="value">13</span>
  }
}</code></pre>
        </div>
        <div class="terminal-foot"><span role="status" id="copy-status"></span><a href="/api/v1/stats">Abrir respuesta en vivo <span aria-hidden="true">&nearr;</span></a></div>
      </div>
    </section>
    <section class="features" aria-labelledby="funciones">
      <h2 id="funciones">Qué puedes consultar</h2>
      <dl>
        <div><dt>Productos</dt><dd>Busca por nombre, filtra por precio y ordena los resultados.</dd></div>
        <div><dt>Categorías</dt><dd>Consulta cada categoría por slug y recorre su catálogo paginado.</dd></div>
        <div><dt>Inventario</dt><dd>Filtra por disponibilidad o define un umbral de stock bajo.</dd></div>
      </dl>
    </section>
  </main>
  <footer class="wrap footer">
    <span>StravAPI <span class="version">v1</span></span>
    <span>Fastify · TypeScript · PostgreSQL · Drizzle</span>
  </footer>
</body>
</html>`;
}

export const homeJs = `
const button = document.querySelector('#copy');
const status = document.querySelector('#copy-status');
if (navigator.clipboard) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('curl ' + location.origin + '/api/v1/stats');
      status.textContent = 'Comando copiado.';
    } catch {
      status.textContent = 'No se pudo copiar.';
    }
  });
}
`;

export const homeCss = `
@font-face { font-family: 'Instrument Sans'; src: url('/assets/instrument-sans.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
:root {
  color-scheme: dark;
  --bg: #0d1614;
  --surface: #121f1b;
  --panel: #101d19;
  --line: #31433c;
  --text: #f0f6f2;
  --muted: #b1c2ba;
  --accent: #8ff3c0;
  --mono: ui-monospace, 'Cascadia Mono', Consolas, monospace;
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 'Instrument Sans', system-ui, sans-serif; }
::selection { background: var(--accent); color: #10251b; }
a { color: inherit; text-underline-offset: .26em; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
[hidden] { display: none !important; }
.wrap { width: min(1200px, calc(100% - 112px)); margin-inline: auto; }
.skip { position: fixed; z-index: 2; top: .75rem; left: 1rem; transform: translateY(-200%); background: var(--accent); color: var(--bg); padding: .65rem 1rem; }
.skip:focus { transform: none; }
main:focus { outline: none; }
.masthead { min-height: 86px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: .72rem; font-size: 1.35rem; font-weight: 660; letter-spacing: -.035em; text-decoration: none; min-height: 44px; }
.mark { display: grid; grid-template-columns: repeat(3, 4px); align-items: end; gap: 3px; background: var(--accent); padding: 7px; border-radius: 4px; }
.mark i { background: #10251b; height: 8px; }
.mark i:nth-child(2) { height: 13px; }
.mark i:nth-child(3) { height: 18px; }
nav { display: flex; gap: 1.7rem; color: var(--muted); }
nav a { display: flex; align-items: center; min-height: 44px; text-decoration: none; font-size: .9rem; }
nav a:hover, .terminal a:hover { color: var(--accent); text-decoration: underline; }
.hero { min-height: calc(100svh - 86px); display: grid; grid-template-columns: 1.05fr 1fr; align-items: center; gap: clamp(2rem, 6vw, 6rem); padding-block: clamp(3rem, 8vw, 6rem); }
.intro { animation: enter .48s cubic-bezier(.2,.72,.28,1) both; }
h1, h2, p { margin: 0; }
h1 { font-size: clamp(3.2rem, 6.15vw, 5.9rem); line-height: .98; font-weight: 640; letter-spacing: -.04em; }
h1 span { color: var(--accent); }
.intro p { max-width: 39ch; color: var(--muted); margin-top: 1.65rem; font-size: 1.12rem; line-height: 1.6; }
.actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.9rem; }
.button { min-height: 46px; padding: .62rem 1rem; display: inline-flex; align-items: center; justify-content: center; gap: .85rem; border: 1px solid var(--line); border-radius: 6px; text-decoration: none; font-size: .9rem; font-weight: 640; transition: transform .18s, background .18s; }
.button:hover { transform: translateY(-2px); }
.button:active { transform: translateY(1px); }
.primary { background: var(--accent); color: #10251b; border-color: var(--accent); }
.primary:hover { background: #b0f8d4; }
.secondary:hover { background: #20322b; }
.terminal { background: var(--panel); min-width: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; animation: enter .65s cubic-bezier(.2,.72,.28,1) both; }
.terminal-head, .terminal-foot, .response-label { display: flex; align-items: center; gap: .6rem; font-size: .86rem; }
.terminal-head { min-height: 58px; padding: .3rem 1.3rem; background: #182822; border-bottom: 1px solid var(--line); font-weight: 570; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.terminal button { margin-left: auto; font: inherit; color: var(--muted); background: transparent; border: 0; cursor: pointer; min-height: 44px; padding-inline: .5rem; }
.terminal button:hover { color: var(--text); text-decoration: underline; }
.request, .response { padding: 1rem 1.35rem; }
.request { border-bottom: 1px solid var(--line); }
.response { padding-bottom: 1.3rem; }
.response-label { justify-content: space-between; color: var(--muted); margin-bottom: .7rem; }
pre { overflow: auto; margin: 0; font: 400 clamp(.78rem, 1.22vw, .9rem)/1.75 var(--mono); scrollbar-color: var(--line) var(--panel); }
code, .http-status { font-family: var(--mono); }
.http-status, .value, code b { color: var(--accent); }
.key { color: #cae0d4; }
.terminal-foot { min-height: 52px; justify-content: space-between; padding-inline: 1.35rem; border-top: 1px solid var(--line); color: var(--muted); }
.terminal-foot a { display: flex; align-items: center; gap: .42rem; min-height: 44px; }
.features { border-top: 1px solid var(--line); padding-block: clamp(2rem, 5vw, 4rem); }
h2 { font-size: clamp(1.55rem, 3vw, 2.05rem); letter-spacing: -.025em; }
.features dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(1rem, 4vw, 4.5rem); margin: 1.25rem 0 0; }
dt { font-weight: 650; }
dd { color: var(--muted); margin: .3rem 0 0; }
.footer { border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1.25rem; padding-block: 1.5rem; color: var(--muted); font-size: .83rem; }
.version { font-family: var(--mono); margin-left: .35rem; }
@keyframes enter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@media (max-width: 850px) {
  .wrap { width: calc(100% - 56px); }
  .hero { grid-template-columns: 1fr; min-height: auto; gap: 2rem; padding-block: 3.2rem; }
  h1 { font-size: clamp(3rem, 9vw, 5rem); }
}
@media (max-width: 500px) {
  .wrap { width: calc(100% - 36px); }
  .masthead { min-height: 65px; }
  .spec { display: none; }
  .hero { padding-block: 2.6rem; }
  .intro p { font-size: 1rem; }
  .actions .button { width: 100%; }
  .features dl { grid-template-columns: 1fr; gap: 1rem; }
  .terminal-foot { flex-wrap: wrap; }
  #copy-status:empty { display: none; }
  .terminal-foot a { margin-left: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .intro, .terminal { animation: none; }
  .button { transition: none; }
}
`;

export const documentationCss = `
@font-face { font-family: 'Instrument Sans'; src: url('/assets/instrument-sans.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
body { margin: 0; background: #f2f7f3; }
.swagger-ui, .swagger-ui .info .title, .swagger-ui .info p,
.swagger-ui .opblock-tag, .swagger-ui .btn, .swagger-ui input {
  font-family: 'Instrument Sans', system-ui, sans-serif;
}
.swagger-ui .wrapper { max-width: 1200px; padding-inline: clamp(16px, 4vw, 56px); }
.swagger-ui .topbar { display: none; }
.docs-header { background: #0d1614; color: #eff6f1; font: 500 .9rem 'Instrument Sans', system-ui, sans-serif; }
.docs-header nav { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; min-height: 72px; margin: auto; padding-inline: clamp(16px, 4vw, 56px); }
.docs-header a { display: inline-flex; align-items: center; min-height: 44px; color: inherit; }
.docs-header a:first-child { color: #8ff3c0; font-size: 1.28rem; font-weight: 650; letter-spacing: -.035em; text-decoration: none; }
.docs-header a:focus-visible { outline: 2px solid #8ff3c0; outline-offset: 4px; }
.swagger-ui .info { margin-block: clamp(30px, 6vw, 76px) 46px; }
.swagger-ui .info .title { color: #11241b; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.035em; }
.swagger-ui .info .main a.link { display: none; }
.swagger-ui .info .description { max-width: 69ch; }
.swagger-ui .info p { color: #34483d; font-size: 1rem; line-height: 1.55; }
.swagger-ui .markdown code, .swagger-ui .renderedMarkdown code { color: #124e38; background: #e0eee5; }
.swagger-ui .scheme-container, .swagger-ui .authorization__btn { display: none; }
.swagger-ui .btn.execute { background: #236248; border-color: #236248; }
.swagger-ui .opblock.opblock-get { background: #e5f2ec; border-color: #759889; }
.swagger-ui .opblock.opblock-get .opblock-summary-method { background: #236248; }
.swagger-ui .opblock-tag { color: #10291d; letter-spacing: -.02em; }
.swagger-ui :focus-visible { outline: 2px solid #236248; outline-offset: 3px; }
@media (max-width: 640px) {
  .swagger-ui .opblock .opblock-summary { flex-wrap: wrap; }
  .swagger-ui .opblock .opblock-summary-path { overflow-wrap: anywhere; }
  .swagger-ui .opblock .opblock-summary-description { min-width: 100%; padding: .4rem; }
  .swagger-ui .opblock-body { overflow-x: auto; }
}
`;
