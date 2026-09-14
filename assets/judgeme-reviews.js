class JudgeMeReviews extends HTMLElement {
  connectedCallback() {
    this.currentPage = 1;
    this.cardsPerPage = 5;
    this.isMutating = false;
    this.enhanceTimeout = null;

    this.mobileQuery = window.matchMedia("(max-width: 749px)");
    this.reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    this.resume = this.resume.bind(this);
    this.pause = this.pause.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.openReviewForm = this.openReviewForm.bind(this);
    this.updatePagination = this.updatePagination.bind(this);
    this.goToPage = this.goToPage.bind(this);
    this.applyDesktopPagination = this.applyDesktopPagination.bind(this);
    this.buildDesktopPagination = this.buildDesktopPagination.bind(this);
    this.scheduleEnhance = this.scheduleEnhance.bind(this);

    this.observer = new MutationObserver((mutations) => {
      if (this.isMutating) return;
      const isInternal = mutations.every((m) => {
        const target = m.target;
        return (
          target.closest?.(
            ".judgeme-reviews__desktop-pagination, .judgeme-reviews__pagination",
          ) ||
          target.classList?.contains("judgeme-reviews__desktop-pagination") ||
          target.classList?.contains("judgeme-reviews__pagination")
        );
      });
      if (!isInternal) {
        this.scheduleEnhance();
      }
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
    if (this.enhanceTimeout) clearTimeout(this.enhanceTimeout);
    this.observer?.disconnect();
    this.mobileQuery?.removeEventListener("change", this.handleViewportChange);
    this.reducedMotionQuery?.removeEventListener(
      "change",
      this.handleViewportChange,
    );
  }

  scheduleEnhance() {
    if (this.enhanceTimeout) clearTimeout(this.enhanceTimeout);
    this.enhanceTimeout = setTimeout(() => {
      this.enhanceWidget();
      this.handleViewportChange();
    }, 60);
  }

  get track() {
    return (
      this.querySelector(".jdgm-rev-widg__reviews") ||
      this.querySelector(".jdgm-ssr-reviews__list") ||
      this.querySelector(".jm-review-widget__reviews") ||
      this.querySelector(".jdgm-ssr-reviews")
    );
  }

  get cards() {
    return [...this.querySelectorAll(".jdgm-rev, .jm-review-item")];
  }

  enhanceWidget() {
    if (this.isMutating) return;
    this.isMutating = true;

    // Temporarily disconnect observer to prevent recursive mutation loops
    this.observer?.disconnect();

    try {
      const writeReview = this.querySelector(
        "[data-testid='write-review-button'], .jm-action-buttons__button, .jdgm-write-rev-link, .jdgm-rev-widg__write-review, [data-widget-type='write-review']",
      );
      writeReview?.setAttribute("data-native-judgeme-write-review", "");

      this.cards.forEach((card) => {
        // 1. Explicitly remove any avatar elements per user instruction
        card
          .querySelectorAll(
            ".jdgm-rev__avatar, .jdgm-rev__pic, .jdgm-rev__icon, .jm-reviewer-avatar, .jm-reviewer-avatar__image, .jm-reviewer-avatar__initial",
          )
          .forEach((el) => el.remove());

        // 2. Ensure stars/rating are at top of card
        const header = card.querySelector(
          ".jdgm-rev__header, .jm-review-item__header",
        );
        const rating = card.querySelector(".jdgm-rev__rating, .jm-star-rating");
        if (header && rating && header.firstElementChild !== rating) {
          header.prepend(rating);
        }

        // 3. Move reviewer author details & "VERIFIED BUYER" to the bottom of the card
        const authorWrapper = card.querySelector(
          ".jdgm-rev__author-wrapper, .jm-reviewer-info",
        );
        if (authorWrapper) {
          let badge = authorWrapper.querySelector(
            ".jdgm-rev__buyer-badge, .jm-verified-badge",
          );
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "jdgm-rev__buyer-badge";
            authorWrapper.appendChild(badge);
          }
          badge.textContent = "VERIFIED BUYER";

          if (card.lastElementChild !== authorWrapper) {
            card.appendChild(authorWrapper);
          }
        }
      });

      this.featureMiddleOrFiveStarReview();
      this.buildPagination();
      this.buildDesktopPagination();
      this.applyDesktopPagination();
    } finally {
      this.isMutating = false;
      this.observer?.observe(this, { childList: true, subtree: true });
    }
  }

  featureMiddleOrFiveStarReview() {
    // If a featured review is already present and valid, don't duplicate
    const existing = this.querySelector(".judgeme-reviews__review--featured");
    if (existing && this.contains(existing)) return;

    const cards = this.cards;
    if (!cards.length) return;

    const isFiveStar = (card) => {
      // 1. Check data-score attribute
      const dataScoreEl = card.querySelector("[data-score]");
      if (dataScoreEl) {
        const score = parseFloat(dataScoreEl.getAttribute("data-score"));
        if (!isNaN(score)) return score >= 4.9;
      }

      // 2. Check aria-label on star rating element (e.g. "5 out of 5 stars")
      const ratingEl = card.querySelector(
        ".jdgm-rev__rating, .jm-star-rating, [role='img'][aria-label*='star']",
      );
      if (ratingEl) {
        const label = ratingEl.getAttribute("aria-label") || "";
        const match = label.match(/(\d+(\.\d+)?)\s*(out of|\/|\s*stars)/i);
        if (match) {
          return parseFloat(match[1]) >= 4.9;
        }
        if (/^5(\.0)?\b/.test(label.trim())) return true;
      }

      // 3. Check font-icon or class-based stars (e.g. 5 filled stars, 0 empty stars)
      const offStars = card.querySelectorAll(
        ".jdgm-star.jdgm--off, .jm-star--empty",
      );
      if (offStars.length > 0) return false;

      const fontIcons = card.querySelectorAll(".jm-star-rating__font-icon");
      if (fontIcons.length > 0) {
        const hasEmpty = Array.from(fontIcons).some(
          (icon) => icon.textContent.trim() === "\uE001",
        );
        if (hasEmpty) return false;
        const fullCount = Array.from(fontIcons).filter(
          (icon) => icon.textContent.trim() === "\uE000",
        ).length;
        if (fullCount === 5) return true;
      }

      const onStars = card.querySelectorAll(
        ".jdgm-star.jdgm--on, .jm-star--filled, .jm-star--full",
      );
      if (onStars.length === 5) return true;

      return false;
    };

    // Filter candidate 5-star reviews on the visible first page
    const firstPageCards = cards.slice(0, this.cardsPerPage || 5);
    const fiveStarOnFirstPage = firstPageCards.filter(isFiveStar);
    const allFiveStarReviews = cards.filter(isFiveStar);

    let featuredReview = null;
    if (fiveStarOnFirstPage.length > 0) {
      const randomIndex = Math.floor(Math.random() * fiveStarOnFirstPage.length);
      featuredReview = fiveStarOnFirstPage[randomIndex];
    } else if (allFiveStarReviews.length > 0) {
      const randomIndex = Math.floor(Math.random() * allFiveStarReviews.length);
      featuredReview = allFiveStarReviews[randomIndex];
    }

    const label = this.dataset.featuredLabel?.trim() || "Most Loved";
    if (!featuredReview || !label) return;

    featuredReview.classList.add("judgeme-reviews__review--featured");
    const badge = document.createElement("span");
    badge.className = "judgeme-reviews__featured-label";
    badge.textContent = label;
    featuredReview.prepend(badge);
  }

  applyDesktopPagination() {
    const isMobile = this.mobileQuery?.matches;
    const cards = this.cards;
    if (!cards.length) return;

    if (isMobile) {
      // On mobile: all cards are visible in horizontal swipe track
      cards.forEach((card) => {
        card.removeAttribute("data-page-hidden");
      });
      if (this.desktopPagination) {
        this.desktopPagination.style.display = "none";
      }
      if (this.pagination) {
        this.pagination.style.display = "flex";
      }
      this.removeAttribute("data-paginated");
    } else {
      // On desktop: show 5 cards per page
      this.setAttribute("data-paginated", "true");
      if (this.pagination) {
        this.pagination.style.display = "none";
      }
      if (this.desktopPagination) {
        this.desktopPagination.style.display = "flex";
      }

      const totalPages = Math.ceil(cards.length / this.cardsPerPage);
      if (this.currentPage > totalPages) {
        this.currentPage = Math.max(1, totalPages);
      }

      const startIndex = (this.currentPage - 1) * this.cardsPerPage;
      const endIndex = startIndex + this.cardsPerPage;

      cards.forEach((card, index) => {
        if (index >= startIndex && index < endIndex) {
          card.removeAttribute("data-page-hidden");
        } else {
          card.setAttribute("data-page-hidden", "true");
        }
      });
    }
  }

  buildDesktopPagination() {
    const cards = this.cards;
    const totalPages = Math.ceil(cards.length / this.cardsPerPage);
    const track = this.track;
    if (!track) return;

    if (totalPages <= 1) {
      if (this.desktopPagination) {
        this.desktopPagination.remove();
        this.desktopPagination = null;
      }
      return;
    }

    if (!this.desktopPagination) {
      this.desktopPagination = document.createElement("nav");
      this.desktopPagination.className = "judgeme-reviews__desktop-pagination";
      this.desktopPagination.setAttribute(
        "aria-label",
        "Customer reviews pagination",
      );
      track.after(this.desktopPagination);
    }

    this.desktopPagination.innerHTML = "";

    // Previous button
    const prevBtn = document.createElement("button");
    prevBtn.className =
      "judgeme-reviews__page-btn judgeme-reviews__page-btn--prev";
    prevBtn.type = "button";
    prevBtn.innerHTML = "&larr;";
    prevBtn.setAttribute("aria-label", "Previous reviews");
    prevBtn.disabled = this.currentPage <= 1;
    prevBtn.addEventListener("click", () => this.goToPage(this.currentPage - 1));
    this.desktopPagination.appendChild(prevBtn);

    // Dynamic page numbers
    const getPageNumbers = (current, total) => {
      if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      if (current <= 4) {
        return [1, 2, 3, 4, 5, "...", total];
      }
      if (current >= total - 3) {
        return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
      }
      return [1, "...", current - 1, current, current + 1, "...", total];
    };

    const pages = getPageNumbers(this.currentPage, totalPages);
    pages.forEach((p) => {
      if (p === "...") {
        const span = document.createElement("span");
        span.className = "judgeme-reviews__page-ellipsis";
        span.textContent = "…";
        this.desktopPagination.appendChild(span);
      } else {
        const pageBtn = document.createElement("button");
        pageBtn.className = "judgeme-reviews__page-btn";
        pageBtn.type = "button";
        pageBtn.textContent = String(p);
        pageBtn.setAttribute("aria-label", `Page ${p}`);
        if (p === this.currentPage) {
          pageBtn.setAttribute("aria-current", "true");
        }
        pageBtn.addEventListener("click", () => this.goToPage(p));
        this.desktopPagination.appendChild(pageBtn);
      }
    });

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.className =
      "judgeme-reviews__page-btn judgeme-reviews__page-btn--next";
    nextBtn.type = "button";
    nextBtn.innerHTML = "&rarr;";
    nextBtn.setAttribute("aria-label", "Next reviews");
    nextBtn.disabled = this.currentPage >= totalPages;
    nextBtn.addEventListener("click", () => this.goToPage(this.currentPage + 1));
    this.desktopPagination.appendChild(nextBtn);

    if (this.mobileQuery?.matches) {
      this.desktopPagination.style.display = "none";
    }
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.cards.length / this.cardsPerPage);
    if (page < 1 || page > totalPages || page === this.currentPage) return;

    this.currentPage = page;
    this.applyDesktopPagination();
    this.buildDesktopPagination();

    const track = this.track;
    if (track) {
      track.style.opacity = "0.4";
      window.setTimeout(() => {
        track.style.opacity = "1";
      }, 150);
    }

    this.scrollIntoView({
      behavior: this.reducedMotionQuery?.matches ? "auto" : "smooth",
      block: "start",
    });
  }

  buildPagination() {
    const track = this.track;
    if (!track || this.cards.length < 2 || this.pagination) return;

    this.pagination = document.createElement("div");
    this.pagination.className = "judgeme-reviews__pagination";
    this.pagination.setAttribute("aria-label", "Review slides");

    // On mobile: for up to 8 cards show 1 dot per card; for > 8 cards show 5 progress dots
    const numDots = this.cards.length <= 8 ? this.cards.length : 5;
    for (let i = 0; i < numDots; i++) {
      const button = document.createElement("button");
      button.className = "judgeme-reviews__pagination-button";
      button.type = "button";
      button.setAttribute("aria-label", `Slide ${i + 1}`);
      button.addEventListener("click", () => {
        const maxScroll = track.scrollWidth - track.clientWidth;
        const targetScroll = maxScroll * (i / (numDots - 1));
        track.scrollTo({
          left: targetScroll,
          behavior: this.reducedMotionQuery.matches ? "auto" : "smooth",
        });
      });
      this.pagination.append(button);
    }

    track.after(this.pagination);
    track.addEventListener("scroll", this.updatePagination, { passive: true });
    this.updatePagination();

    if (!this.mobileQuery?.matches) {
      this.pagination.style.display = "none";
    }
  }

  updatePagination() {
    if (!this.track || !this.pagination || !this.pagination.children.length)
      return;

    const track = this.track;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const scrollLeft = track.scrollLeft;
    const ratio = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    const numDots = this.pagination.children.length;
    const activeIndex = Math.min(
      numDots - 1,
      Math.max(0, Math.round(ratio * (numDots - 1))),
    );

    [...this.pagination.children].forEach((button, index) => {
      button.setAttribute("aria-current", String(index === activeIndex));
    });
  }

  async openReviewForm() {
    // 1. Try finding native write review button anywhere in DOM
    const nativeWriteReview =
      this.querySelector(
        '[data-testid="write-review-button"], .jm-action-buttons__button, [data-native-judgeme-write-review], .jdgm-write-rev-link, .jdgm-rev-widg__write-review, [data-widget-type="write-review"]',
      ) ||
      document.querySelector(
        '[data-testid="write-review-button"], .jm-action-buttons__button, .jdgm-write-rev-link, .jdgm-rev-widg__write-review',
      );

    if (nativeWriteReview) {
      nativeWriteReview.click();
      return;
    }

    const productId =
      this.dataset.productId ||
      this.querySelector(".jdgm-review-widget")?.dataset.productId ||
      this.querySelector(".jdgm-review-widget")?.dataset.id;

    // 2. Try launching Judge.me's write review modal directly
    if (window.jdgm?._WriteReviewModal && window.jdgm?.$ && productId) {
      try {
        document
          .querySelectorAll(".jdgm-review-widget-modal.jdgm-write-review-modal")
          .forEach((s) => s.remove());
        const modal = new window.jdgm._WriteReviewModal(window.jdgm.$);
        const ready = await modal.setup("jdgm-review-widget-modal", productId, {
          siwsSignedIn: false,
        });
        if (ready) {
          modal.showModalPage();
          return;
        }
      } catch (err) {
        console.warn("[Judge.me] Direct modal launch error:", err);
      }
    }

    // 3. If modal script isn't loaded yet, dynamically load it and show
    if (window.jdgm && productId) {
      const cdnHost = window.jdgm.CDN_HOST || "https://cdnwidget.judge.me/";
      const scriptUrl = cdnHost + "widget/write_review_modal.js";

      const loadScript = () =>
        new Promise((resolve) => {
          if (window.jdgm?._WriteReviewModal) return resolve(true);
          const s = document.createElement("script");
          s.src = scriptUrl;
          s.onload = () => resolve(true);
          s.onerror = () => resolve(false);
          document.head.appendChild(s);
        });

      const ok = await loadScript();
      if (ok && window.jdgm?._WriteReviewModal && window.jdgm?.$) {
        document
          .querySelectorAll(".jdgm-review-widget-modal.jdgm-write-review-modal")
          .forEach((s) => s.remove());
        const modal = new window.jdgm._WriteReviewModal(window.jdgm.$);
        const ready = await modal.setup("jdgm-review-widget-modal", productId, {
          siwsSignedIn: false,
        });
        if (ready) {
          modal.showModalPage();
          return;
        }
      }
    }

    // 4. Fallback for inline form if present
    const formWrapper = this.querySelector(".jdgm-form-wrapper, .jdgm-form");
    if (formWrapper) {
      formWrapper.style.display = "block";
      formWrapper.scrollIntoView({
        behavior: this.reducedMotionQuery.matches ? "auto" : "smooth",
        block: "center",
      });
    }
  }

  handleViewportChange() {
    this.pause();
    this.applyDesktopPagination();
    if (this.mobileQuery?.matches) {
      if (this.desktopPagination) this.desktopPagination.style.display = "none";
      if (this.pagination) this.pagination.style.display = "flex";
      this.resume();
    } else {
      if (this.pagination) this.pagination.style.display = "none";
      if (this.desktopPagination) this.desktopPagination.style.display = "flex";
    }
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

    const currentScroll = track.scrollLeft;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const cardWidth = cards[0].offsetWidth + 16;

    let nextScroll = currentScroll + cardWidth;
    if (nextScroll >= maxScroll + 10) {
      nextScroll = 0;
    }

    track.scrollTo({ left: nextScroll, behavior: "smooth" });
  }
}

if (!customElements.get("judge-me-reviews")) {
  customElements.define("judge-me-reviews", JudgeMeReviews);
}
