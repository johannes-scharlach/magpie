import MessageFormat from "intl-messageformat";
import type { IntlShape, MessageDescriptor, PrimitiveType } from "react-intl";

/**
 * The app's Babel transform gives every message a catalog ID from its text.
 * Vitest does not run that transform, and react-intl refuses to format a
 * descriptor without an ID, so tests format the source messages directly with
 * the same ICU engine and Intl formatters react-intl delegates to.
 */
export function testIntl(locale = "en"): IntlShape {
  const formats = new Map<string, MessageFormat>();

  function message(source: string, values?: object) {
    let format = formats.get(source);
    if (!format) {
      format = new MessageFormat(source, locale);
      formats.set(source, format);
    }
    return String(format.format(values));
  }

  return {
    formatMessage: (
      descriptor: string | MessageDescriptor,
      values?: Record<string, PrimitiveType>,
    ) =>
      message(
        typeof descriptor === "string"
          ? descriptor
          : typeof descriptor.defaultMessage === "string"
            ? descriptor.defaultMessage
            : "",
        values,
      ),
    formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(value),
  } as unknown as IntlShape;
}
