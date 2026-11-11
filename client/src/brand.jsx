// The business's colours and logo, from GET /api/clinic.

// Sets the page's colour variables (client/src/styles.css). Through the style object, which the
// Content Security Policy allows, unlike a <style> tag or a style="" attribute.
export function applyBrand(brand) {
  if (!brand) return;
  const root = document.documentElement.style;
  root.setProperty('--navy', brand.dark);
  root.setProperty('--teal', brand.accent);
  root.setProperty('--mint', brand.light);
}

// The logo if the business has one, otherwise its initials in a circle. The name next to it is
// read out by screen readers, so the picture itself is decoration.
export function Logo({ clinic }) {
  if (clinic?.logo) return <img className="logo-img" src="/api/logo" alt="" />;
  if (clinic?.initials) return <span className="monogram" aria-hidden="true">{clinic.initials}</span>;
  return null;
}
