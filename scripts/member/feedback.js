// scripts/member/feedback.js
// Shows the five-second community story on entry and app resume.
// Respects the admin setting while keeping the form banner available.
// RELEVANT FILES: index.html, styles/member-feedback.css, scripts/member/auth.js
(() => {
  const story = document.getElementById('feedback-story');
  const progress = story.querySelector('progress');
  const pauseButton = story.querySelector('.feedback-pause');
  const duration = 5000;
  let ready = false;
  let enabled = false;
  let unsubscribeSettings;
  let settingsSession = 0;
  let paused = false;
  let elapsed = 0;
  let lastTick = 0;
  let frame;
  let previousFocus;
  let returningFromForm = false;

  function stop() {
    cancelAnimationFrame(frame);
    lastTick = 0;
  }

  function tick(now) {
    if (!story.open || paused || document.hidden) return;
    if (lastTick) elapsed += now - lastTick;
    lastTick = now;
    progress.value = Math.min(duration, elapsed);
    if (elapsed >= duration) story.close();
    else frame = requestAnimationFrame(tick);
  }

  function play() {
    stop();
    if (story.open && !paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function setPaused(value) {
    paused = value;
    pauseButton.setAttribute('aria-pressed', String(value));
    pauseButton.textContent = value ? 'Continuar anuncio' : 'Pausar anuncio';
    play();
  }

  function open() {
    if (!ready || !enabled || document.hidden || story.open) return;
    // A booking/profile dialog must retain priority over this announcement.
    if (document.querySelector('dialog[open]')) return;
    previousFocus = document.activeElement;
    elapsed = 0;
    progress.value = 0;
    story.showModal();
    setPaused(false);
  }

  story.querySelector('.feedback-close').addEventListener('click', () => story.close());
  pauseButton.addEventListener('click', () => setPaused(!paused));
  // Keyboard users can explore the link without racing the auto-dismiss timer.
  story.addEventListener('keydown', event => {
    if (event.key === 'Tab') setPaused(true);
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
        unsubscribeSettings = null;
        enabled = false;
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
      }
    }
  };
})();
