import { Component } from '@theme/component';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * Normalizes Shopify IDs (handles both GIDs like gid://shopify/Product/123 and numeric 123)
 * @param {string | number | undefined} id
 * @returns {string}
 */
function extractId(id) {
  if (!id) return '';
  const str = String(id);
  const lastSlash = str.lastIndexOf('/');
  return lastSlash !== -1 ? str.slice(lastSlash + 1) : str;
}

/**
 * Updates the price and compare-at-price display cleanly without text-node duplication.
 * @param {HTMLElement} container
 * @param {string} formattedPrice
 * @param {string | null} formattedCompareAt
 */
function updatePriceDisplay(container, formattedPrice, formattedCompareAt) {
  if (!container || !formattedPrice) return;

  const priceElem = container.querySelector('.price');
  let compareElem = container.querySelector('.compare-at-price');

  if (priceElem) {
    let hiddenSpan = priceElem.querySelector('.visually-hidden');
    if (formattedCompareAt) {
      if (!hiddenSpan) {
        priceElem.classList.add('price-item__group');
        hiddenSpan = document.createElement('span');
        hiddenSpan.className = 'visually-hidden';
        hiddenSpan.innerHTML = 'Sale price&nbsp;';
      }
      priceElem.replaceChildren(hiddenSpan, document.createTextNode(` ${formattedPrice}`));
    } else {
      if (hiddenSpan) {
        hiddenSpan.remove();
        priceElem.classList.remove('price-item__group');
      }
      priceElem.textContent = formattedPrice;
    }
  }

  if (formattedCompareAt) {
    if (!compareElem && priceElem) {
      compareElem = document.createElement('span');
      compareElem.className = 'price-item__group price-item--regular compare-at-price';
      const hiddenSpan = document.createElement('span');
      hiddenSpan.className = 'visually-hidden';
      hiddenSpan.innerHTML = 'Regular price&nbsp;';
      compareElem.appendChild(hiddenSpan);
      priceElem.insertAdjacentElement('afterend', compareElem);
    }
    if (compareElem) {
      compareElem.style.display = '';
      let hiddenSpan = compareElem.querySelector('.visually-hidden');
      if (!hiddenSpan) {
        hiddenSpan = document.createElement('span');
        hiddenSpan.className = 'visually-hidden';
        hiddenSpan.innerHTML = 'Regular price&nbsp;';
      }
      compareElem.replaceChildren(hiddenSpan, document.createTextNode(` ${formattedCompareAt}`));
    }
  } else if (compareElem) {
    compareElem.style.display = 'none';
  }
}

/**
 * @typedef {Object} ProductPriceRefs
 * @property {HTMLElement} [priceContainer]
 * @property {HTMLElement} [volumePricingNote]
 */

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 *
 * @extends {Component<ProductPriceRefs>}
 */
class ProductPrice extends Component {
  /** @type {Element | Document | null} */
  #target = null;

  connectedCallback() {
    super.connectedCallback();
    this.#target = this.closest('.shopify-section, dialog') || document;
    this.#target.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#target?.removeEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.#target = null;
  }

  /**
   * Optimistically update the price display immediately upon variant selection.
   * @param {string | number | undefined} variantId
   * @param {Element | null} pickerElement
   */
  #updateLivePrice(variantId, pickerElement) {
    const rawVariantId = extractId(variantId);
    if (!rawVariantId && !pickerElement) return;

    let formattedPrice = null;
    let formattedCompareAt = null;

    // 1. Try finding by matching variant ID on input or option
    if (rawVariantId) {
      const variantEl =
        pickerElement?.querySelector?.(`[data-variant-id="${rawVariantId}"]`) ||
        document.querySelector(`variant-picker [data-variant-id="${rawVariantId}"]`);
      if (variantEl?.dataset?.price) {
        formattedPrice = variantEl.dataset.price;
        formattedCompareAt = variantEl.dataset.compareAtPrice || null;
      }
    }

    // 2. Try finding from checked/selected input or option
    if (!formattedPrice) {
      const selectedInput =
        pickerElement?.querySelector?.('input[type="radio"]:checked, option:checked') ||
        document.querySelector('variant-picker input[type="radio"]:checked, variant-picker option:checked');
      if (selectedInput?.dataset?.price) {
        formattedPrice = selectedInput.dataset.price;
        formattedCompareAt = selectedInput.dataset.compareAtPrice || null;
      }
    }

    // 3. Fallback to data-variants-json in picker
    if (!formattedPrice) {
      const variantsScript =
        pickerElement?.querySelector?.('script[data-variants-json]') ||
        document.querySelector('variant-picker script[data-variants-json]');
      if (variantsScript?.textContent) {
        try {
          const variants = JSON.parse(variantsScript.textContent);
          const matched = variants.find((v) => extractId(v.id) === rawVariantId);
          if (matched) {
            formattedPrice = matched.formatted_price;
            formattedCompareAt = matched.formatted_compare_at_price;
          }
        } catch (_) {}
      }
    }

    if (!formattedPrice) return;

    // Update main product price container
    const priceContainer = this.querySelector('[ref="priceContainer"]') || this;
    updatePriceDisplay(priceContainer, formattedPrice, formattedCompareAt);

    // Update sticky add to cart bar price container if present
    const stickyPriceContainer =
      document.querySelector('.sticky-add-to-cart__price [ref="priceContainer"]') ||
      document.querySelector('.sticky-add-to-cart__price');
    if (stickyPriceContainer) {
      updatePriceDisplay(stickyPriceContainer, formattedPrice, formattedCompareAt);
    }
  }

  /**
   * Handles product select event and updates the price.
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    const currentProductId = extractId(this.dataset.productId);
    const eventProductId = extractId(event.product?.id);

    if (eventProductId && currentProductId && eventProductId !== currentProductId) {
      return;
    }

    // 1. Instant optimistic live update (zero latency)
    this.#updateLivePrice(event.detail?.variantId, event.target);

    // 2. Full server reconciliation when HTML arrives from Shopify
    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html, newProduct } = detail;

        if (newProduct?.id) {
          this.dataset.productId = extractId(newProduct.id);
        } else if (detail.productId) {
          const detailPid = extractId(detail.productId);
          const currentPid = extractId(this.dataset.productId);
          if (detailPid && currentPid && detailPid !== currentPid) {
            return;
          }
        }

        // Find the matching product-price element in the server response HTML
        const newProductPrice =
          html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`) ||
          html.querySelector('product-price');
        if (!newProductPrice) return;

        const currentPriceContainer = this.querySelector('[ref="priceContainer"]') || this;
        const newPriceContainer = newProductPrice.querySelector('[ref="priceContainer"]') || newProductPrice;

        if (currentPriceContainer && newPriceContainer) {
          currentPriceContainer.innerHTML = newPriceContainer.innerHTML;
        }

        // Update volume pricing note if present
        const newVolumeNote = newProductPrice.querySelector('[ref="volumePricingNote"]');
        const currentVolumeNote = this.querySelector('[ref="volumePricingNote"]');
        if (newVolumeNote) {
          if (currentVolumeNote) {
            currentVolumeNote.innerHTML = newVolumeNote.innerHTML;
          } else {
            this.appendChild(newVolumeNote.cloneNode(true));
          }
        } else if (currentVolumeNote) {
          currentVolumeNote.remove();
        }

        // Sync sticky add to cart bar if present
        const stickyPriceContainer =
          document.querySelector('.sticky-add-to-cart__price [ref="priceContainer"]') ||
          document.querySelector('.sticky-add-to-cart__price');
        if (stickyPriceContainer && newPriceContainer) {
          stickyPriceContainer.innerHTML = newPriceContainer.innerHTML;
        }

        // Update installments (SPI banner) variant ID to trigger payment terms re-render
        const installmentsInput = /** @type {HTMLInputElement|null} */ (
          this.querySelector(`#product-form-installment-${this.dataset.blockId} input[name="id"]`) ||
          this.querySelector('.installments input[name="id"]')
        );
        if (installmentsInput) {
          installmentsInput.value = extractId(detail.resource?.id) ?? '';
          installmentsInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this.updatedCallback?.();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[product-price] Event promise rejected:', error);
      });
  };
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
