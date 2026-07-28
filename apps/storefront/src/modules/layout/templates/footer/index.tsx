import { Text } from "@modules/common/components/ui";

import Instagram from "@modules/common/icons/instagram";
import Telegram from "@modules/common/icons/telegram";

export default function Footer() {
  return (
    <footer className="border-t border-ui-border-base w-full">
      <div className="content-container flex flex-col w-full pt-16">
        <div className="flex w-full mb-16 justify-between text-ui-fg-muted">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} Strike Shop. All rights reserved.
          </Text>
          <div className="flex gap-x-4">
            <a
              href="#"
              target="_blank"
              rel="noreferrer"
              aria-label="Telegram"
              className="hover:text-ui-fg-base"
            >
              <Telegram />
            </a>
            <a
              href="#"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hover:text-ui-fg-base"
            >
              <Instagram />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
