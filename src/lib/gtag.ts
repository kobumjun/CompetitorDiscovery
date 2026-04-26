const SIGNUP_SEND_TO = "AW-18116965099/BM0PCNO97qIcEOvl675D";
const SIGNUP_LS_KEY = "pp_signup_conversion_fired";

export function fireSignupConversion() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SIGNUP_LS_KEY)) return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("event", "conversion", { send_to: SIGNUP_SEND_TO });
  localStorage.setItem(SIGNUP_LS_KEY, "1");
}
