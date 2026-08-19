class HomeUgc extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-ugc-track]');
    this.addEventListener('click', this.handleClick);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.querySelectorAll('video').forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      if (reduceMotion) video.pause();
      else video.play().catch(() => this.updateVideoControls(video));
      video.addEventListener('play', () => this.updateVideoControls(video));
      video.addEventListener('pause', () => this.updateVideoControls(video));
      video.addEventListener('volumechange', () => this.updateVideoControls(video));
    });
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
  }

  handleClick = (event) => {
    const button = event.target.closest('button');
    if (!button || !this.contains(button)) return;

    if (button.matches('[data-ugc-previous], [data-ugc-next]')) {
      const card = this.track?.querySelector('.home-ugc__card');
      if (!this.track || !card) return;
      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      this.track.scrollBy({ left: (card.getBoundingClientRect().width + gap) * (button.hasAttribute('data-ugc-next') ? 1 : -1), behavior: 'smooth' });
      return;
    }

    const media = button.closest('.home-ugc__media');
    const video = media?.querySelector('video');
    if (!video) return;

    if (button.hasAttribute('data-ugc-playback')) {
      if (video.paused) video.play().catch(() => this.updateVideoControls(video));
      else video.pause();
    } else if (button.hasAttribute('data-ugc-volume')) {
      video.muted = !video.muted;
    }
  };

  updateVideoControls(video) {
    const media = video.closest('.home-ugc__media');
    const playback = media?.querySelector('[data-ugc-playback]');
    const volume = media?.querySelector('[data-ugc-volume]');
    if (playback) {
      playback.dataset.state = video.paused ? 'paused' : 'playing';
      playback.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
      playback.setAttribute('aria-pressed', String(!video.paused));
    }
    if (volume) {
      volume.dataset.state = video.muted ? 'muted' : 'unmuted';
      volume.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
      volume.setAttribute('aria-pressed', String(!video.muted));
    }
  }
}

if (!customElements.get('home-ugc')) customElements.define('home-ugc', HomeUgc);
