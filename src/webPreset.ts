// import { isUndefined, noop, isWindowDefined, isDocumentDefined } from './helper'

import { isUndefined } from "lodash-es";

// @ts-ignore
const noop = () => {
  1;
};
export const isWindowDefined = typeof window != "undefined";
export const isDocumentDefined = typeof document != "undefined";
/**
 * Due to the bug https://bugs.chromium.org/p/chromium/issues/detail?id=678075,
 * it's not reliable to detect if the browser is currently online or offline
 * based on `navigator.onLine`.
 * As a workaround, we always assume it's online on the first load, and change
 * the status upon `online` or `offline` events.
 */
let online = true;
const isOnline = () => online;

// For node and React Native, `add/removeEventListener` doesn't exist on window.
const [onWindowEvent, offWindowEvent] =
  isWindowDefined && window.addEventListener
    ? [
        window.addEventListener.bind(window),
        window.removeEventListener.bind(window),
      ]
    : [noop, noop];

export const isVisible = () => {
  const visibilityState = isDocumentDefined && document.visibilityState;
  return isUndefined(visibilityState) || visibilityState !== "hidden";
};

const initFocus = (callback: () => void) => {
  // focus revalidate
  if (isDocumentDefined) {
    document.addEventListener("visibilitychange", callback);
  }
  onWindowEvent("focus", callback);
  return () => {
    if (isDocumentDefined) {
      document.removeEventListener("visibilitychange", callback);
    }
    offWindowEvent("focus", callback);
  };
};

const initReconnect = (callback: () => void) => {
  // revalidate on reconnected
  const onOnline = () => {
    online = true;
    callback();
  };
  // nothing to revalidate, just update the status
  const onOffline = () => {
    online = false;
  };
  onWindowEvent("online", onOnline);
  onWindowEvent("offline", onOffline);
  return () => {
    offWindowEvent("online", onOnline);
    offWindowEvent("offline", onOffline);
  };
};
