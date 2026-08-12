import type { Plugin } from "unified";

export const logMessages: Plugin = () => {
  return (_tree, file) => {
    for (const message of file.messages) {
      const origin = [message.source, message.ruleId].filter(Boolean).join(":");
      const output = origin === "" ? String(message) : `${String(message)} ${origin}`;
      if (message.fatal === true) {
        console.error(output);
      } else if (message.fatal === false) {
        console.warn(output);
      } else {
        console.info(output);
      }
    }
  };
};
