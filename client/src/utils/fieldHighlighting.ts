/**
 * Field Highlighting Utility
 * Applies and removes visual highlighting for required fields
 */

export const highlightField = (fieldName: string) => {
  // Try different selectors to find the field
  const selectors = [
    `input[name='${fieldName}']`,
    `select[name='${fieldName}']`,
    `textarea[name='${fieldName}']`,
    `[data-field-name='${fieldName}']`,
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      element.classList.add("booking-field-highlight");
      return true;
    }
  }

  return false;
};

export const clearFieldHighlight = (fieldName: string) => {
  const selectors = [
    `input[name='${fieldName}']`,
    `select[name='${fieldName}']`,
    `textarea[name='${fieldName}']`,
    `[data-field-name='${fieldName}']`,
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      element.classList.remove("booking-field-highlight");
    }
  }
};

export const clearAllHighlights = () => {
  const highlighted = document.querySelectorAll(".booking-field-highlight");
  highlighted.forEach((el) => {
    el.classList.remove("booking-field-highlight");
  });
};

export const scrollToField = (fieldName: string) => {
  const selectors = [
    `input[name='${fieldName}']`,
    `select[name='${fieldName}']`,
    `textarea[name='${fieldName}']`,
    `[data-field-name='${fieldName}']`,
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
  }

  return false;
};
