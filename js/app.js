/* ============================================================
   Registratie + automatische verversing
   - registreert de service worker
   - ververszt de pagina automatisch wanneer er een nieuwe build
     actief wordt (één keer, met een sessionStorage-bescherming
     zodat het nooit in een herlaad-lus terechtkomt)
   ============================================================ */

(function () {
  var BUILD = '20261020a';
  var KEY = 'jdj-reloaded-';

  function pageBuild() {
    var m = document.querySelector('meta[name="build"]');
    return m ? m.content : '';
  }

  function reloadOnce(newBuild) {
    var key = KEY + newBuild;
    try {
      if (sessionStorage.getItem(key)) return;   // al gedaan: nooit twee keer
      sessionStorage.setItem(key, '1');
    } catch (err) { /* private mode: gewoon herladen */ }
    window.location.reload();
  }

  // alleen herladen als de actieve build écht anders is dan wat er op het
  // scherm staat — anders verstoren we de bezoeker bij een eerste bezoek
  function maybeReload(newBuild) {
    if (!newBuild || newBuild === pageBuild()) return;
    reloadOnce(newBuild);
  }

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // Handmatige check: is er een nieuwe service worker?
      // Een wachtende sw betekent dat sw.js veranderd is, dus ook de build.
      function checkUpdate() {
        if (reg.waiting) { reloadOnce('waiting-' + Date.now()); return; }
        if (reg.installing) return;
        reg.update().catch(function () {});
      }

      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            reloadOnce('updatefound-' + Date.now());
          }
        });
      });

      // Nieuwe versie actief -> de sw stuurt zijn build mee
      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'JDJ_UPDATED') maybeReload(e.data.build);
      });
      reg.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'JDJ_UPDATED') maybeReload(e.data.build);
      });

      // Bij terugkeer naar het tabblad: controleren op een nieuwe build
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkUpdate();
      });

      // Check na 60s en na 1 uur (GitHub Pages/Fastly cachet HTML 10 min)
      setTimeout(checkUpdate, 60000);
      setInterval(checkUpdate, 3600000);
    }).catch(function () {
      /* geen service worker mogelijk: de ?v=BUILD-querystring blijft werken */
    });
  });
})();
