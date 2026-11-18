// scripts/member/feedback.js
// Plays the active reels one after another (story style) on entry and app resume, each with its own layout.
// Respects the admin on/off switch, the reels staff edit and how often each reel may show; the form banner stays available.
// RELEVANT FILES: index.html, scripts/reel-template.js, styles/member-feedback.css, scripts/admin/reels.js
(() => {
  const story = document.getElementById('feedback-story');
  const progress = story.querySelector('progress'); // screen-reader progress of the current reel
  const pauseButton = story.querySelector('.feedback-pause');
  const steps = document.getElementById('feedback-steps'); // one visual segment per reel
  const link = document.getElementById('feedback-story-link');
  const content = document.getElementById('feedback-story-content'); // gets the reel's layout classes
  const VIEWS_KEY = 'madnessReelViews'; // { [reelId]: { day: 'YYYY-MM-DD', count } } on this phone
  let ready = false;
  let enabled = false;
  let unsubscribeSettings;
  let unsubscribeReels;
  let settingsSession = 0;
  let reels = [];            // active reels from Firestore, in staff order
  let reelsLoaded = false;   // never open before we know which reels to show
  let queue = [];            // the reels of the story that is open right now
  let index = 0;             // which reel of the queue is on screen
  let duration = 5000;       // milliseconds for the current reel
  let paused = false;
  let elapsed = 0;
  let lastTick = 0;
  let frame;
  let previousFocus;
  let returningFromForm = false;
  let seenThisStory = new Set(); // going back to a reel in the same story does not count twice

  // Puts one reel's text, button and seconds on screen.
  function render(reel) {
    const template = window.madnessReel;
    duration = (template ? template.seconds(reel) : 5) * 1000;
    if (!template) return;
    content.className = `feedback-story-content ${template.className(reel)}`;
    document.getElementById('feedback-copy').innerHTML = template.copyHTML(reel);
    document.getElementById('feedback-action').hidden = !reel.ctaUrl; // no link = no button
    if (reel.ctaUrl) link.href = reel.ctaUrl;
    document.getElementById('feedback-cta-text').textContent = reel.ctaText || 'Abrir enlace';
    document.getElementById('feedback-footer').textContent = reel.footer || '';
    document.getElementById('feedback-seconds').textContent = `${template.seconds(reel)} s`;
  }

  // Segments: finished ones full, the current one fills with --fill, later ones empty.
  function drawSteps() {
    steps.innerHTML = queue.map((_, i) =>
      `<span class="feedback-step${i < index ? ' is-done' : i === index ? ' is-current' : ''}"><i></i></span>`).join('');
  }

  // ----- How often a reel shows: remembered per reel and per Mexico City day, on this phone only. -----
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  function readViews() {
    try { return JSON.parse(localStorage.getItem(VIEWS_KEY)) || {}; } catch { return {}; }
  }
  function canShow(reel, views) {
    const seen = views[reel.id] || {};
    const countToday = seen.day === today() ? Number(seen.count) || 0 : 0;
    const frequency = window.madnessReel ? window.madnessReel.layout(reel).frequency : 'daily3';
    if (frequency === 'once') return !seen.day; // never seen on this phone
    if (frequency === 'daily') return countToday < 1;
    if (frequency === 'daily3') return countToday < 3;
    return true; // 'always'
  }
  function markSeen(reel) {
    if (!reel?.id || seenThisStory.has(reel.id)) return;
    seenThisStory.add(reel.id);
    const views = readViews();
    const day = today();
    const count = views[reel.id]?.day === day ? (Number(views[reel.id].count) || 0) + 1 : 1;
    // Keep only reels that still exist, so the record stays tiny.
    const kept = Object.fromEntries(Object.entries(views).filter(([id]) => reels.some(r => r.id === id)));
    kept[reel.id] = { day, count };
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(kept)); } catch { /* private mode: show without counting */ }
  }

  function showStep(next) {
    index = next;
    elapsed = 0;
    lastTick = 0;
    render(queue[index] || {});
    markSeen(queue[index]);
    progress.max = duration;
    progress.value = 0;
    drawSteps();
    steps.style.setProperty('--fill', '0%');
  }

  function stop() {
    cancelAnimationFrame(frame);
    lastTick = 0;
  }

  function tick(now) {
    if (!story.open || paused || document.hidden) return;
    if (lastTick) elapsed += now - lastTick;
    lastTick = now;
    progress.value = Math.min(duration, elapsed);
    steps.style.setProperty('--fill', `${Math.min(100, (elapsed / duration) * 100)}%`);
    if (elapsed >= duration) goTo(index + 1);
    else frame = requestAnimationFrame(tick);
  }

  function play() {
    stop();
    if (story.open && !paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  // Moves to another reel; past the last one the story closes.
  function goTo(next) {
    if (next >= queue.length) { story.close(); return; }
    showStep(Math.max(0, next));
    play();
  }

  function setPaused(value) {
    paused = value;
    pauseButton.setAttribute('aria-pressed', String(value));
    pauseButton.textContent = value ? 'Continuar anuncio' : 'Pausar anuncio';
    play();
  }

  function open() {
    // Only the reels staff activated are shown; none active means no story, even with the switch on.
    if (!ready || !enabled || !reelsLoaded || !reels.length || document.hidden || story.open) return;
    // A booking/profile dialog must retain priority over this announcement.
    if (document.querySelector('dialog[open]')) return;
    // Only the reels this member may still see now (frequency); none left means no story.
    const views = readViews();
    const allowed = reels.filter(reel => canShow(reel, views));
    if (!allowed.length) return;
    previousFocus = document.activeElement;
    queue = allowed;
    seenThisStory = new Set();
    showStep(0);
    story.showModal();
    setPaused(false);
  }

  story.querySelector('.feedback-close').addEventListener('click', () => story.close());
  pauseButton.addEventListener('click', () => setPaused(!paused));
  // Tap like a story: left 30% of the screen goes back, anywhere else goes forward.
  // Taps on the link and the buttons keep their own behavior.
  story.addEventListener('click', event => {
    if (event.target?.closest?.('a, button')) return;
    goTo(event.clientX < (window.innerWidth || 0) * 0.3 ? index - 1 : index + 1);
  });
  // Keyboard users can explore the link without racing the auto-dismiss timer.
  story.addEventListener('keydown', event => {
    if (event.key === 'Tab') setPaused(true);
    if (event.key === 'ArrowRight') goTo(index + 1);
    if (event.key === 'ArrowLeft') goTo(index - 1);
  });
  story.addEventListener('close', () => {
    stop();
    if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus();
    else document.getElementById('main-content').focus({ preventScroll: true });
  });
  for (const id of ['feedback-banner', 'feedback-story-link']) {
    document.getElementById(id).addEventListener('click', () => {
      returningFromForm = true;
      if (story.open) story.close();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); return; }
    // Returning from Google Forms should not immediately cover the agenda again.
    if (returningFromForm) { returningFromForm = false; return; }
    if (story.open) play();
    else open();
  });
  window.madnessFeedback = {
    setReady(value) {
      const entering = value && !ready;
      ready = value;
      if (!ready) {
        settingsSession += 1;
        unsubscribeSettings?.();
        unsubscribeReels?.();
        unsubscribeSettings = null;
        unsubscribeReels = null;
        enabled = false;
        reels = [];
        reelsLoaded = false;
        if (story.open) story.close();
      }
      if (entering) {
        const currentSession = ++settingsSession;
        // Wait for the setting before opening; a disabled reel must never flash first.
        unsubscribeSettings = db.collection('appSettings').doc('feedbackReel').onSnapshot({ includeMetadataChanges: true }, snapshot => {
          if (currentSession !== settingsSession || snapshot.metadata?.fromCache) return;
          const wasEnabled = enabled;
          enabled = !snapshot.exists || snapshot.data().enabled === true;
          if (!enabled && story.open) story.close();
          if (enabled && !wasEnabled) open();
        }, error => {
          if (currentSession !== settingsSession) return;
          enabled = false;
          if (story.open) story.close();
          console.warn('Feedback reel settings failed:', error);
        });
        // Active reels, sorted by the order staff set. An open story keeps its reels until it closes.
        unsubscribeReels = db.collection('reels').where('active', '==', true).onSnapshot({ includeMetadataChanges: true }, snapshot => {
          if (currentSession !== settingsSession || snapshot.metadata?.fromCache) return;
          reels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
          const firstLoad = !reelsLoaded;
          reelsLoaded = true;
          if (firstLoad) open();
        }, error => {
          if (currentSession !== settingsSession) return;
          // Reels unreadable (e.g. rules not deployed yet): show nothing rather than a stale reel.
          reels = [];
          reelsLoaded = true;
          console.warn('Reels failed:', error);
        });
      }
    }
  };
})();
