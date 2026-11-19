/* Filet de sécurité : si l'application ne démarre pas (fichier JS manquant après
   une mise à jour, réseau coupé), on affiche une sortie de secours au lieu de
   laisser une page blanche. Fichier externe et non script en ligne, pour rester
   compatible avec la politique de sécurité (CSP) qui n'autorise que nos scripts. */
(function () {
  var shown = false;

  function rescue() {
    var root = document.getElementById('root');
    if (shown || !root || root.childElementCount > 0) return;
    shown = true;
    root.innerHTML =
      '<div style="min-height:100vh;display:grid;place-items:center;background:#14110E;color:#F5EFE6;' +
      'font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px">' +
      '<div style="max-width:420px">' +
      '<p style="letter-spacing:.3em;color:#C9A227;font-size:12px;margin:0">BOOK FOREVER</p>' +
      '<h1 style="font-family:Georgia,serif;font-size:26px;margin:14px 0 10px">Chargement interrompu</h1>' +
      '<p style="color:#C4B8A4;margin:0 0 22px">La page n’a pas fini de se charger. Vos achats et vos ' +
      'lectures sont intacts.</p>' +
      '<button id="bf-reload" style="padding:13px 26px;border-radius:999px;border:0;background:#C9A227;' +
      'color:#14110E;font-weight:600;margin-right:10px">Recharger</button>' +
      '<button id="bf-reset" style="padding:13px 22px;border-radius:999px;border:1px solid rgba(201,162,39,.5);' +
      'background:transparent;color:#F5EFE6;font-weight:500">Vider le cache</button>' +
      '</div></div>';
    document.getElementById('bf-reload').onclick = function () {
      location.reload();
    };
    document.getElementById('bf-reset').onclick = function () {
      var done = function () {
        location.reload();
      };
      if (!('caches' in window)) return done();
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (k) {
              return caches.delete(k);
            }),
          );
        })
        .then(done, done);
    };
  }

  window.addEventListener(
    'error',
    function (event) {
      var msg = (event && (event.message || '')) + '';
      if (/dynamically imported module|Loading chunk|module script failed/i.test(msg)) rescue();
    },
    true,
  );

  setTimeout(rescue, 8000);
})();
