import { setLogoFallback, setLogoSrc } from "/lib/image.mjs";

function watchSetLogo(img) {
  if (img.dataset.bound) return;
  img.dataset.bound = "1";
  const apply = (width, height) => {
    const src = img.getAttribute("src") || "";
    const next = setLogoFallback(src, width, height);
    if (!next) {
      img.hidden = true;
      return;
    }
    if (next !== src) img.src = next;
  };
  img.addEventListener("error", () => apply(0, 1));
  img.addEventListener("load", () => apply(img.naturalWidth, img.naturalHeight));
}

export function bindSetLogos(root) {
  (root || document).querySelectorAll("[data-set-logo]").forEach(watchSetLogo);
}

export function showSetLogo(img, id) {
  if (!img) return;
  watchSetLogo(img);
  const src = setLogoSrc(id);
  if (!src) {
    img.hidden = true;
    img.removeAttribute("src");
    return;
  }
  img.hidden = false;
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  else if (img.complete && img.naturalWidth) img.dispatchEvent(new Event("load"));
}

export { setLogoSrc };
