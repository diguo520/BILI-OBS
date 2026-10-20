const AUTO_SCROLL_KEY = "comments-auto-scroll";

export function getAutoScrollPreference(): boolean {
  return localStorage.getItem(AUTO_SCROLL_KEY) !== "false";
}

export function setAutoScrollPreference(value: boolean) {
  localStorage.setItem(AUTO_SCROLL_KEY, String(value));
}
