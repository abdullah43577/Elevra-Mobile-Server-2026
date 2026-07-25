export const stripHtml = function (html: string) {
  if (!html) return "";
  let text = html.replace(/<[^>]*>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};
