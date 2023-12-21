import { isUndefined } from "lodash-es";

export const isWindowDefined = typeof window != "undefined";
export const isDocumentDefined = typeof document != "undefined";

export const isVisible = () => {
  const visibilityState = isDocumentDefined && document.visibilityState;
  return isUndefined(visibilityState) || visibilityState !== "hidden";
};
