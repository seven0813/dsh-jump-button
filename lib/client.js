/**
 * dsh-jump-buttons — Client half.
 *
 * Two floating buttons on the right edge of the conversation:
 *   ↑  jump to the top of the latest user question
 *   ↓  return to the live end and re-attach to the built-in follow-to-bottom
 *
 * The plugin never writes DOM outside its own React tree and never replicates
 * the host's follow state machine: it only moves the existing scroll container,
 * which the host already interprets as reader movement.
 */
window.__ModuleLoader__.load({
  id: "dsh-jump-buttons",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    const SCROLL_SELECTOR = "[data-conversation-scroll]";
    const USER_SELECTOR = '[data-chat-flow-kind="user"]';
    const TO_BOTTOM_LABEL = /^(back to bottom|回到底部)$/i;
    const QUESTION_OFFSET = 10;
    const NEAR_BOTTOM = 32;

    const TEXT = {
      zh: { up: "回到问题开头", down: "回到结尾" },
      en: { up: "Jump to question start", down: "Jump to end" },
    };

    const CSS = `
.dshJumpRoot {
  position: fixed;
  right: 16px;
  bottom: 140px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.dshJumpBtn {
  pointer-events: auto;
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  font: inherit;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.dshJumpBtn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border-color: var(--dsw-alias-border-l1);
}
.dshJumpBtn:active {
  transform: scale(0.94);
}
.dshJumpBtn:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
@media (max-width: 900px) {
  .dshJumpRoot { right: 12px; bottom: 132px; }
}
@media (prefers-reduced-motion: reduce) {
  .dshJumpBtn { transition: none; }
}
`;

    function ArrowUp() {
      return h(
        "svg",
        {
          width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
          stroke: "currentColor", strokeWidth: 2,
          strokeLinecap: "round", strokeLinejoin: "round",
          "aria-hidden": true, focusable: false,
        },
        h("path", { d: "M12 19V5" }),
        h("path", { d: "M6 11l6-6 6 6" }),
      );
    }

    function ArrowDown() {
      return h(
        "svg",
        {
          width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
          stroke: "currentColor", strokeWidth: 2,
          strokeLinecap: "round", strokeLinejoin: "round",
          "aria-hidden": true, focusable: false,
        },
        h("path", { d: "M12 5v14" }),
        h("path", { d: "M6 13l6 6 6-6" }),
      );
    }

    function findScroller() {
      return document.querySelector(SCROLL_SELECTOR);
    }

    /** Absolute scrollTop that puts the last user question near the top. */
    function questionTarget(scroller) {
      const nodes = scroller.querySelectorAll(USER_SELECTOR);
      const node = nodes[nodes.length - 1];
      if (!node) return null;
      const offset =
        scroller.scrollTop +
        node.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return Math.max(0, Math.min(offset - QUESTION_OFFSET, max));
    }

    function findNativeToBottom() {
      for (const button of document.querySelectorAll("button[aria-label]")) {
        if (!TO_BOTTOM_LABEL.test((button.getAttribute("aria-label") || "").trim())) continue;
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !button.disabled) return button;
      }
      return null;
    }

    function isZh() {
      const lang = document.documentElement.getAttribute("lang") || navigator.language || "en";
      return /^zh/i.test(lang);
    }

    function JumpButtons() {
      const [visible, setVisible] = React.useState(false);
      const [zh, setZh] = React.useState(() => isZh());
      // 0 keeps the default bottom-right seat; 56 slides the stack left of the
      // turn-navigation rail when a long conversation makes the rail reach it.
      const [shiftRight, setShiftRight] = React.useState(0);
      // Guards late follow-up work from a jump the user has already replaced.
      const actionRef = React.useRef(0);

      React.useEffect(() => {
        let timer = 0;
        let disposed = false;

        const read = () => {
          if (disposed) return;
          const scroller = findScroller();
          const modalOpen = !!document.querySelector(
            '[aria-modal="true"], [role="dialog"]',
          );
          const scrollable =
            !!scroller && scroller.scrollHeight - scroller.clientHeight > 24;
          const nextVisible = scrollable && !modalOpen;
          const nextZh = isZh();

          // The rail is vertically centred and only reaches the bottom-right
          // corner in very long conversations; step left when it does.
          let nextShift = 0;
          const rail = document.querySelector('nav[aria-label="Turn navigation"]');
          if (rail) {
            const railRect = rail.getBoundingClientRect();
            const stackTop = window.innerHeight - 140 - 80;
            const stackBottom = window.innerHeight - 140;
            const stackLeft = window.innerWidth - 16 - 36;
            if (
              railRect.right > stackLeft &&
              railRect.bottom > stackTop &&
              railRect.top < stackBottom
            ) {
              nextShift = 56;
            }
          }

          setVisible((value) => (value === nextVisible ? value : nextVisible));
          setZh((value) => (value === nextZh ? value : nextZh));
          setShiftRight((value) => (value === nextShift ? value : nextShift));
        };

        // Streaming mutates text nodes continuously; a short debounce keeps the
        // visibility check cheap without missing session switches or layout changes.
        const schedule = () => {
          if (disposed || timer) return;
          timer = window.setTimeout(() => {
            timer = 0;
            read();
          }, 120);
        };

        read();
        const observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["lang", "aria-modal", "role"],
        });
        window.addEventListener("resize", schedule);
        window.addEventListener("scroll", schedule, { capture: true, passive: true });

        return () => {
          disposed = true;
          observer.disconnect();
          window.removeEventListener("resize", schedule);
          window.removeEventListener("scroll", schedule, { capture: true });
          if (timer) window.clearTimeout(timer);
        };
      }, []);

      const jumpToQuestion = () => {
        const token = ++actionRef.current;
        const scroller = findScroller();
        if (!scroller) return;
        const target = questionTarget(scroller);
        if (target == null) return;

        const distance =
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (distance <= NEAR_BOTTOM) {
          // Follow-to-bottom is armed at this position; a smooth animation
          // would be pulled back by the next streamed token. Leave the follow
          // window instantly instead.
          scroller.scrollTop = target;
          return;
        }

        scroller.scrollTo({ top: target, behavior: "smooth" });
        window.setTimeout(() => {
          if (actionRef.current !== token) return;
          const current = findScroller();
          if (!current) return;
          const nextTarget = questionTarget(current);
          if (nextTarget == null) return;
          const gap =
            current.scrollHeight - current.scrollTop - current.clientHeight;
          // The stream re-attached the view to the bottom mid-animation:
          // finish with an instant jump.
          if (gap <= NEAR_BOTTOM && Math.abs(current.scrollTop - nextTarget) > 8) {
            current.scrollTop = nextTarget;
          }
        }, 420);
      };

      const jumpToEnd = () => {
        const token = ++actionRef.current;
        const scroller = findScroller();
        if (!scroller) return;

        const native = findNativeToBottom();
        if (native) {
          native.click();
        } else {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        }

        window.setTimeout(() => {
          if (actionRef.current !== token) return;
          const current = findScroller();
          if (!current) return;
          const gap =
            current.scrollHeight - current.scrollTop - current.clientHeight;
          // Reaching the bottom is what re-arms the host's follow; a smooth
          // scroll that lost its race against new output ends here.
          if (gap > 4) current.scrollTop = current.scrollHeight;
        }, 480);
      };

      if (!visible) return null;

      const labels = TEXT[zh ? "zh" : "en"];

      return h(
        React.Fragment,
        null,
        h("style", { key: "style" }, CSS),
        h(
          "div",
          {
            className: "dshJumpRoot",
            "data-dsh-jump-buttons": "",
            style: shiftRight ? { right: shiftRight } : undefined,
          },
          h(
            "button",
            {
              key: "up",
              type: "button",
              className: "dshJumpBtn",
              title: labels.up,
              "aria-label": labels.up,
              "data-dsh-jump": "question",
              onClick: jumpToQuestion,
            },
            h(ArrowUp),
          ),
          h(
            "button",
            {
              key: "down",
              type: "button",
              className: "dshJumpBtn",
              title: labels.down,
              "aria-label": labels.down,
              "data-dsh-jump": "end",
              onClick: jumpToEnd,
            },
            h(ArrowDown),
          ),
        ),
      );
    }

    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.slots.inject("shell.overlay", () =>
          ctx.slots.register(
            { name: "shell.overlay", id: "dsh-jump-buttons", order: 60 },
            JumpButtons,
          ),
        );
      },
    };
  },
});
