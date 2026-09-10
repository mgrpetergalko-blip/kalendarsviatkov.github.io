/* =========================================================
   SERVICE WORKER + MANUÁLNA AKTUALIZÁCIA
========================================================= */

const brandIcon = document.getElementById('brandIcon');

let refreshing = false;

/* Automatický reload, keď nový SW prevezme kontrolu */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }
  );
}

const checkForUpdates = async () => {

  if (!('serviceWorker' in navigator)) {
    showToast('Aktualizácie nie sú podporované');
    return;
  }

  brandIcon.classList.add('spinning');

  try {
    const reg = await navigator.serviceWorker.getRegistration();

    if (!reg) {
      // Žiadny SW – skús ho zaregistrovať
      await navigator.serviceWorker.register('sw.js');
      showToast('Aplikácia pripravená offline ✨');
      return;
    }

    // Vynútiť kontrolu nového SW
    await reg.update();

    // Ak existuje čakajúci SW, aktivuj ho
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      showToast('Aktualizujem…');
      return;
    }

    // Ak sa inštaluje nový SW
    if (reg.installing) {
      showToast('Sťahujem novú verziu…');
      return;
    }

    // Inak – všetko je aktuálne
    setTimeout(() => {
      brandIcon.classList.remove('spinning');
      showToast('Máš najnovšiu verziu ✓');
    }, 600);

  } catch (err) {
    brandIcon.classList.remove('spinning');
    showToast('Aktualizácia zlyhala');
  }
};

/* Klik + klávesnica (Enter / Space) */
brandIcon.addEventListener('click', checkForUpdates);
brandIcon.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    checkForUpdates();
  }
});

/* Fallback: keď sa spinner nikdy nezastaví po 6s, vypni ho */
setInterval(() => {
  if (!navigator.serviceWorker?.controller) return;
  brandIcon.classList.remove('spinning');
}, 6000);

/* Registrácia SW pri načítaní */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .catch(() => {});
  });
}
