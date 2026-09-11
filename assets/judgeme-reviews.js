class JudgeMeReviews extends HTMLElement {
  connectedCallback() {
    this.mobileQuery = window.matchMedia("(max-width: 749px)");
    this.reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.resume = this.resume.bind(this);
    this.pause = this.pause.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.openReviewForm = this.openReviewForm.bind(this);
    this.updatePagination = this.updatePagination.bind(this);

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
    this.querySelector("[data-judgeme-write-review]")?.addEventListener(
      "click",
      this.openReviewForm,
    );
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
    writeReview?.setAttribute("data-native-judgeme-write-review", "");
    this.featureRandomFiveStarReview();
    this.buildPagination();
  }

  featureRandomFiveStarReview() {
    if (this.querySelector(".judgeme-reviews__review--featured")) return;

    const fiveStarReviews = this.cards.filter((card) => {
      const rating = card.querySelector(".jdgm-rev__rating[data-score]");
      return Number(rating?.dataset.score) === 5;
    });
    const featuredReview =
      fiveStarReviews[Math.floor(Math.random() * fiveStarReviews.length)];
    const label = this.dataset.featuredLabel?.trim();
    if (!featuredReview || !label) return;

    featuredReview.classList.add("judgeme-reviews__review--featured");
    const badge = document.createElement("span");
    badge.className = "judgeme-reviews__featured-label";
    badge.textContent = label;
    featuredReview.prepend(badge);
  }

  buildPagination() {
    const track = this.track;
    if (!track || this.cards.length < 2 || this.pagination) return;

    this.pagination = document.createElement("div");
    this.pagination.className = "judgeme-reviews__pagination";
    this.pagination.setAttribute("aria-label", "Review slides");
    this.cards.forEach((card, index) => {
      const button = document.createElement("button");
      button.className = "judgeme-reviews__pagination-button";
      button.type = "button";
      button.setAttribute("aria-label", `Show review ${index + 1}`);
      button.addEventListener("click", () => {
        card.scrollIntoView({
          behavior: this.reducedMotionQuery.matches ? "auto" : "smooth",
          block: "nearest",
          inline: "center",
        });
      });
      this.pagination.append(button);
    });
    track.after(this.pagination);
    track.addEventListener("scroll", this.updatePagination, { passive: true });
    this.updatePagination();
  }

  updatePagination() {
    if (!this.track || !this.pagination) return;

    const currentIndex = this.getCurrentReviewIndex();
    [...this.pagination.children].forEach((button, index) => {
      button.setAttribute("aria-current", String(index === currentIndex));
    });
  }

  openReviewForm() {
    const nativeWriteReview = this.querySelector(
      "[data-native-judgeme-write-review]",
    );
    if (!nativeWriteReview) return;

    nativeWriteReview.click();
    window.requestAnimationFrame(() => {
      this.querySelector(".jdgm-form-wrapper")?.scrollIntoView({
        behavior: this.reducedMotionQuery.matches ? "auto" : "smooth",
        block: "center",
      });
    });
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

    const currentIndex = this.getCurrentReviewIndex();
    const nextCard = cards[(currentIndex + 1) % cards.length];

    track.scrollTo({ left: nextCard.offsetLeft, behavior: "smooth" });
  }

  getCurrentReviewIndex() {
    const track = this.track;
    const cards = this.cards;
    if (!track || !cards.length) return 0;

    return cards.reduce((closestIndex, card, index) => {
      const currentDistance = Math.abs(
        cards[closestIndex].offsetLeft - track.scrollLeft,
      );
      const candidateDistance = Math.abs(card.offsetLeft - track.scrollLeft);
      return candidateDistance < currentDistance ? index : closestIndex;
    }, 0);
  }
}

if (!customElements.get("judge-me-reviews")) {
  customElements.define("judge-me-reviews", JudgeMeReviews);
}
