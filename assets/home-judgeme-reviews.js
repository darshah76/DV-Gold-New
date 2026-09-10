const MOBILE_MEDIA = window.matchMedia("(max-width: 749px)");
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

class HomeJudgemeReviews extends HTMLElement {
  connectedCallback() {
    this.writeButton = this.querySelector("[data-judgeme-write]");
    this.pagination = this.querySelector("[data-judgeme-pagination]");
    this.writeButton?.addEventListener("click", this.openReviewForm);
    MOBILE_MEDIA.addEventListener("change", this.handleViewportChange);
    this.observer = new MutationObserver(() => this.setup());
    this.observer.observe(this, { childList: true, subtree: true });
    this.setup();
  }

  disconnectedCallback() {
    this.writeButton?.removeEventListener("click", this.openReviewForm);
    MOBILE_MEDIA.removeEventListener("change", this.handleViewportChange);
    this.observer?.disconnect();
    window.clearInterval(this.autoplayTimer);
  }

  openReviewForm = () => {
    const trigger = document.querySelector(
      '.jdgm-write-rev-link, .jdgm-write-review, [data-judgeme-write-review], a[href*="write_review"]',
    );

    if (trigger instanceof HTMLElement && trigger !== this.writeButton) {
      trigger.click();
      trigger.scrollIntoView({
        behavior: REDUCED_MOTION.matches ? "auto" : "smooth",
        block: "center",
      });
      return;
    }

    window.location.assign("/pages/reviews#judgeme_all_reviews_page");
  };

  handleViewportChange = () => {
    this.showPage(0);
    this.startMobileAutoplay();
  };

  setup() {
    const items = [...this.querySelectorAll(".jdgm-carousel-item")];
    if (!items.length || items.length === this.itemCount) return;
    this.itemCount = items.length;
    this.items = items;
    this.renderPagination();
    this.startMobileAutoplay();
  }

  renderPagination() {
    if (!this.pagination) return;
    const pageCount = Math.ceil(this.items.length / 6);
    this.pagination.replaceChildren();
    this.pagination.hidden = pageCount < 2;

    for (let page = 0; page < pageCount; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "home-judgeme__page";
      button.textContent = String(page + 1);
      button.setAttribute("aria-label", `Show review page ${page + 1}`);
      button.addEventListener("click", () => this.showPage(page));
      this.pagination.append(button);
    }

    this.showPage(0);
  }

  showPage(page) {
    if (MOBILE_MEDIA.matches) {
      this.items.forEach((item) => item.removeAttribute("hidden"));
      return;
    }

    this.items.forEach((item, index) => {
      item.toggleAttribute(
        "hidden",
        index < page * 6 || index >= (page + 1) * 6,
      );
    });
    [...this.pagination.children].forEach((button, index) => {
      if (index === page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  startMobileAutoplay() {
    window.clearInterval(this.autoplayTimer);
    if (
      !MOBILE_MEDIA.matches ||
      REDUCED_MOTION.matches ||
      this.items.length < 2
    )
      return;
    const delay = Number(this.dataset.autoplaySeconds || 5) * 1000;
    this.autoplayTimer = window.setInterval(() => {
      if (document.hidden || !this.matches(":not(:hover)")) return;
      this.querySelector(
        ".jdgm-carousel__right-arrow, .jdgm-carousel__next-btn",
      )?.click();
    }, delay);
  }
}

if (!customElements.get("home-judgeme-reviews")) {
  customElements.define("home-judgeme-reviews", HomeJudgemeReviews);
}
