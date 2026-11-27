/* ADISEN — comportements minimaux : menu mobile et apparition des sections.
   Aucune dépendance, aucun appel réseau. */
(function () {
  'use strict';

  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var ouvert = nav.classList.toggle('ouvert');
      burger.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
      burger.textContent = ouvert ? '✕' : '☰';
    });

    nav.addEventListener('click', function (event) {
      if (event.target.tagName === 'A' && nav.classList.contains('ouvert')) {
        nav.classList.remove('ouvert');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Ouvrir le menu');
        burger.textContent = '☰';
      }
    });
  }

  var cibles = document.querySelectorAll('.rev');
  var reduire = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduire) {
    Array.prototype.forEach.call(cibles, function (el) {
      el.classList.add('vu');
    });
    return;
  }

  var observateur = new IntersectionObserver(
    function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) {
          entree.target.classList.add('vu');
          observateur.unobserve(entree.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  Array.prototype.forEach.call(cibles, function (el) {
    observateur.observe(el);
  });
})();
