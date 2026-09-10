class JudgeMeReviews extends HTMLElement {
  connectedCallback() {
    this.mobileQuery = window.matchMedia("(max-width: 749px)");
    this.reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.resume = this.resume.bind(this);
    this.pause = this.pause.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);

    this.observer = new MutationObserver(() => {
      this.enhanceWidget();
      this.handleViewportChange();
    });
    this.observer.observe(this, { childList: true, subtree: true });
    this.mobileQuery.addEventListener("change", this.handleViewportChange);
    this.reducedMotionQuery.addEventListener(
      "change",
      this.handleViewportChange,
    );
    this.addEventListener("pointerenter", this.pause);
    this.addEventListener("pointerleave", this.resume);
    this.addEventListener("focusin", this.pause);
    this.addEventListener("focusout", this.resume);
    this.enhanceWidget();
    this.handleViewportChange();
  }

  disconnectedCallback() {
    this.pause();
    this.observer?.disconnect();
    this.mobileQuery?.removeEventListener("change", this.handleViewportChange);
    this.reducedMotionQuery?.removeEventListener(
      "change",
      this.handleViewportChange,
    );
  }

  get track() {
    return this.querySelector(".jdgm-rev-widg__reviews");
  }

  get cards() {
    return [...this.querySelectorAll(".jdgm-rev-widg__reviews > .jdgm-rev")];
  }

  enhanceWidget() {
    const writeReview = this.querySelector(".jdgm-write-rev-link");
    writeReview?.classList.add("button");
  }

  handleViewportChange() {
    this.pause();
    this.resume();
  }

  resume() {
    if (
      !this.mobileQuery?.matches ||
      this.reducedMotionQuery?.matches ||
      this.cards.length < 2 ||
      this.timer
    )
      return;

    const delay = Number(this.dataset.autoplaySeconds || 5) * 1000;
    this.timer = window.setInterval(() => this.showNextReview(), delay);
  }

  pause() {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  showNextReview() {
    const track = this.track;
    const cards = this.cards;
    if (!track || cards.length < 2) return;

    const currentIndex = cards.reduce((closestIndex, card, index) => {
      const currentDistance = Math.abs(
        cards[closestIndex].offsetLeft - track.scrollLeft,
      );
      const candidateDistance = Math.abs(card.offsetLeft - track.scrollLeft);
      return candidateDistance < currentDistance ? index : closestIndex;
    }, 0);
    const nextCard = cards[(currentIndex + 1) % cards.length];

    track.scrollTo({ left: nextCard.offsetLeft, behavior: "smooth" });
  }
}

if (!customElements.get("judge-me-reviews")) {
  customElements.define("judge-me-reviews", JudgeMeReviews);
}
