// scripts/verify-member-scroll.cjs
// Checks that touch scrolling keeps navigation anchored on every member screen.
// Covers long content, boundary swipes, safe areas and viewport changes with fixtures.
// RELEVANT FILES: scripts/verify-member.cjs, styles/member-shell.css, index.html
module.exports = async page => {
  const client = await page.createCDPSession();
  try {
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    for (const [width, height, safeTop] of [[320, 568, 47], [390, 844, 47], [390, 720, 47], [402, 874, 62], [844, 390, 47]]) {
      await page.setViewport({ width, height });
      for (const screen of ['agenda', 'history', 'profile', 'classDetails']) {
        for (const longContent of [false, true]) {
          const baseline = await page.evaluate(({ screen, longContent, safeTop }) => {
            document.documentElement.style.setProperty('--safe-top', `${safeTop}px`);
            document.documentElement.style.setProperty('--safe-bottom', '34px');
            __preview.app.navigateTo(screen, { classId: 'fixture-trx' });
            const scroller = screen === 'classDetails'
              ? document.querySelector('.class-detail-content')
              : document.getElementById('main-content');
            // Force enough fixture content to exercise both scroll boundaries on every screen.
            const extra = document.createElement('div');
            extra.dataset.scrollFixture = '';
            extra.style.height = '1400px';
            if (longContent) scroller.append(extra);
            scroller.scrollTop = 0;
            const nav = document.querySelector('.app-bottom-nav').getBoundingClientRect();
            return { top: nav.top, bottom: nav.bottom, scrollable: scroller.scrollHeight > scroller.clientHeight + 1 };
          }, { screen, longContent, safeTop });
          let moved = false;
          for (const edge of ['top', 'bottom']) {
            const points = await page.evaluate(({ screen, edge }) => {
              const scroller = screen === 'classDetails'
                ? document.querySelector('.class-detail-content')
                : document.getElementById('main-content');
              scroller.scrollTop = edge === 'top' ? 0 : scroller.scrollHeight;
              const rect = scroller.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, top: rect.top + 20,
                bottom: Math.min(rect.bottom - 20, rect.top + 170), start: scroller.scrollTop };
            }, { screen, edge });
            // Swipe into the content, then beyond its boundary in both directions.
            for (const upward of [edge === 'top', edge !== 'top']) {
              const startY = upward ? points.bottom : points.top;
              const endY = upward ? points.top : points.bottom;
              await client.send('Input.dispatchTouchEvent', {
                type: 'touchStart', touchPoints: [{ x: points.x, y: startY }]
              });
              for (const progress of [.25, .5, .75, 1]) {
                await client.send('Input.dispatchTouchEvent', {
                  type: 'touchMove', touchPoints: [{ x: points.x, y: startY + (endY - startY) * progress }]
                });
              }
              await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              const metrics = await page.evaluate(screen => {
                const nav = document.querySelector('.app-bottom-nav').getBoundingClientRect();
                const scroller = screen === 'classDetails'
                  ? document.querySelector('.class-detail-content')
                  : document.getElementById('main-content');
                const frame = document.body.getBoundingClientRect();
                const navStyle = getComputedStyle(document.querySelector('.app-bottom-nav'));
                return { top: nav.top, bottom: nav.bottom, viewport: innerHeight,
                  frameTop: frame.top, frameBottom: frame.bottom,
                  safeBottom: parseFloat(navStyle.paddingBottom),
                  root: document.scrollingElement.scrollTop, scroll: scroller.scrollTop };
              }, screen);
              moved ||= Math.abs(metrics.scroll - points.start) > 1;
              if (metrics.root || Math.abs(metrics.top - baseline.top) > 1 ||
                  Math.abs(metrics.bottom - metrics.viewport) > 1 ||
                  Math.abs(metrics.frameTop) > 1 || Math.abs(metrics.frameBottom - metrics.viewport) > 1 ||
                  metrics.safeBottom !== 34) {
                throw Error(`Navigation moved on ${screen} at ${width}x${height}: ${JSON.stringify(metrics)}`);
              }
            }
          }
          if (baseline.scrollable && !moved) throw Error(`Content did not scroll on ${screen} at ${width}x${height}`);
          await page.evaluate(() => document.querySelectorAll('[data-scroll-fixture]').forEach(e => e.remove()));
        }
      }
      console.log('Touch scrolling and anchored navigation: all four screens', width, height, 'PASS');
    }
  } finally {
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await client.detach();
    await page.setViewport({ width: 390, height: 844 });
  }
};
