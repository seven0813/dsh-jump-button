/**
 * dsh-jump-buttons — Client half.
 *
 * Three floating buttons on the right edge of the active conversation:
 *   ↑   jump to the start of the turn currently being read
 *   ↓   jump to the end of that turn
 *   ↓↓  jump to the live end (the latest turn)
 *
 * "Turn" means one user question plus its answer. The turn under the viewport
 * top is the one the reader is looking at; it does not have to be the latest.
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
    const TURN_OFFSET = 10;
    const END_MARGIN = 16;
    const READING_LINE = 64;
    const NEAR_BOTTOM = 32;
    const BUTTON_SIZE = 36;
    const BUTTON_GAP = 8;
    const STACK_HEIGHT = BUTTON_SIZE * 3 + BUTTON_GAP * 2;
    const STACK_BOTTOM = 140;
    const NARROW_BOTTOM = 132;
    const SIDE_STEP = 48;

    const TEXT = {
      zh: {
        start: "回到本轮开头",
        end: "回到本轮结尾",
        latest: "回到最新",
      },
      en: {
        start: "Jump to turn start",
        end: "Jump to turn end",
        latest: "Jump to latest",
      },
    };

    const CSS = `
.dshJumpRoot {
  position: fixed;
  right: 16px;
  bottom: ${STACK_BOTTOM}px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: ${BUTTON_GAP}px;
  pointer-events: none;
}
.dshJumpBtn {
  pointer-events: auto;
  box-sizing: border-box;
  width: ${BUTTON_SIZE}px;
  height: ${BUTTON_SIZE}px;
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
  .dshJumpRoot { bottom: ${NARROW_BOTTOM}px; }
}
@media (prefers-reduced-motion: reduce) {
  .dshJumpBtn { transition: none; }
}
`;

    function isZh() {
      const lang = document.documentElement.getAttribute("lang") || navigator.language || "en";
      return /^zh/i.test(lang);
    }

    function intersects(a, b) {
      return !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    }

    function visibleRect(el) {
      if (!el || !el.isConnected) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return null;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return null;
      return rect;
    }

    function onScreen(el) {
      const rect = visibleRect(el);
      if (!rect) return false;
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    }

    function scrollerOf(node) {
      return node && node.closest ? node.closest(SCROLL_SELECTOR) : null;
    }

    /** The conversation the reader last clicked into; survives own-button clicks. */
    let lastScroller = null;

    /**
     * The conversation the reader is looking at. Several conversation roots can
     * be mounted at once (right-side side chat, split panes); the first one in
     * the document is not necessarily the active one.
     */
    function resolveScroller() {
      const all = Array.from(document.querySelectorAll(SCROLL_SELECTOR));
      if (!all.length) return null;

      const focused = document.activeElement;
      if (focused) {
        const own = scrollerOf(focused);
        if (own && onScreen(own)) return own;
        const pane = focused.closest ? focused.closest("[data-dockkit-pane]") : null;
        const inPane = pane ? pane.querySelector(SCROLL_SELECTOR) : null;
        if (inPane && onScreen(inPane)) return inPane;
      }

      if (lastScroller && lastScroller.isConnected && onScreen(lastScroller)) {
        return lastScroller;
      }

      const activePane = document.querySelector("[data-dockkit-pane-active]");
      if (activePane) {
        const inPane = activePane.querySelector(SCROLL_SELECTOR);
        if (inPane && onScreen(inPane)) return inPane;
      }

      let best = null;
      let bestArea = 0;
      for (const el of all) {
        const rect = visibleRect(el);
        if (!rect) continue;
        const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const area = width * height;
        if (area > bestArea) {
          best = el;
          bestArea = area;
        }
      }
      return best || all[all.length - 1];
    }

    function absoluteTop(scroller, node) {
      return (
        scroller.scrollTop +
        node.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top
      );
    }

    function clampTarget(scroller, value) {
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return Math.max(0, Math.min(value, max));
    }

    /** The turn whose question is the last one above the reading line. */
    function currentTurn() {
      const scroller = resolveScroller();
      if (!scroller) return null;
      const nodes = Array.from(scroller.querySelectorAll(USER_SELECTOR));
      if (!nodes.length) return null;

      const base = scroller.scrollTop;
      const top = scroller.getBoundingClientRect().top;
      const line = base + READING_LINE;

      // At the live end the latest turn is what the reader is looking at, even
      // when that turn is shorter than the viewport and its question sits below
      // the reading line.
      const gap = scroller.scrollHeight - base - scroller.clientHeight;
      if (gap <= NEAR_BOTTOM) {
        return { scroller, nodes, index: nodes.length - 1 };
      }

      let index = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const nodeTop = base + nodes[i].getBoundingClientRect().top - top;
        if (nodeTop <= line) index = i;
        else break;
      }
      return { scroller, nodes, index };
    }

    function findNativeToBottom(scroller) {
      for (const button of scroller.querySelectorAll("button[aria-label]")) {
        if (!TO_BOTTOM_LABEL.test((button.getAttribute("aria-label") || "").trim())) continue;
        if (visibleRect(button) && !button.disabled) return button;
      }
      return null;
    }

    function smoothJump(scroller, target, token, actionRef) {
      const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (gap <= NEAR_BOTTOM) {
        // Follow-to-bottom is armed here; a smooth animation would be pulled
        // back by the next streamed token.
        scroller.scrollTop = target;
        return;
      }
      scroller.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(() => {
        if (actionRef.current !== token || !scroller.isConnected) return;
        const nextGap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (nextGap <= NEAR_BOTTOM && Math.abs(scroller.scrollTop - target) > 8) {
          scroller.scrollTop = target;
        }
      }, 420);
    }

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

    function ArrowDownDouble() {
      return h(
        "svg",
        {
          width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
          stroke: "currentColor", strokeWidth: 2,
          strokeLinecap: "round", strokeLinejoin: "round",
          "aria-hidden": true, focusable: false,
        },
        h("path", { d: "M6 6l6 6 6-6" }),
        h("path", { d: "M6 13l6 6 6-6" }),
      );
    }

    function JumpButtons() {
      const [visible, setVisible] = React.useState(false);
      const [zh, setZh] = React.useState(() => isZh());
      const [right, setRight] = React.useState(16);
      // Guards late follow-up work from a jump the user has already replaced.
      const actionRef = React.useRef(0);

      React.useEffect(() => {
        let timer = 0;
        let disposed = false;

        const read = () => {
          if (disposed) return;
          const scroller = resolveScroller();
          const modalOpen = !!document.querySelector(
            '[aria-modal="true"], [role="dialog"]',
          );
          const scrollable =
            !!scroller && scroller.scrollHeight - scroller.clientHeight > 24;
          const nextVisible = scrollable && !modalOpen;
          const nextZh = isZh();

          const narrow = window.innerWidth <= 900;
          const bottom = narrow ? NARROW_BOTTOM : STACK_BOTTOM;
          let nextRight = 16;
          if (scroller) {
            const rect = scroller.getBoundingClientRect();
            nextRight = Math.max(12, Math.round(window.innerWidth - rect.right + 16));
          }

          const stack = () => ({
            left: window.innerWidth - nextRight - BUTTON_SIZE,
            right: window.innerWidth - nextRight,
            top: window.innerHeight - bottom - STACK_HEIGHT,
            bottom: window.innerHeight - bottom,
          });

          // Keep clear of the native back-to-bottom button and of the turn
          // navigation rail inside the same conversation.
          if (scroller) {
            const native = findNativeToBottom(scroller);
            if (native && intersects(stack(), native.getBoundingClientRect())) {
              nextRight += SIDE_STEP;
            }
            const rail = scroller.querySelector('nav[aria-label="Turn navigation"]');
            const railRect = rail ? visibleRect(rail) : null;
            if (railRect && intersects(stack(), railRect)) {
              nextRight += SIDE_STEP;
            }
          }

          setVisible((value) => (value === nextVisible ? value : nextVisible));
          setZh((value) => (value === nextZh ? value : nextZh));
          setRight((value) => (value === nextRight ? value : nextRight));
        };

        // Streaming mutates text nodes continuously; a short debounce keeps the
        // visibility check cheap without missing session switches or pane changes.
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
          attributeFilter: ["lang", "aria-modal", "role", "data-dockkit-pane-active"],
        });
        window.addEventListener("resize", schedule);
        window.addEventListener("scroll", schedule, { capture: true, passive: true });
        document.addEventListener("focusin", schedule, true);

        const rememberPointer = (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          let own = scrollerOf(target);
          if (!own) {
            const pane = target.closest("[data-dockkit-pane]");
            if (pane) own = pane.querySelector(SCROLL_SELECTOR);
          }
          if (own) lastScroller = own;
          schedule();
        };
        document.addEventListener("pointerdown", rememberPointer, true);
        document.addEventListener("pointerup", schedule, true);

        return () => {
          disposed = true;
          observer.disconnect();
          window.removeEventListener("resize", schedule);
          window.removeEventListener("scroll", schedule, { capture: true });
          document.removeEventListener("focusin", schedule, true);
          document.removeEventListener("pointerdown", rememberPointer, true);
          document.removeEventListener("pointerup", schedule, true);
          if (timer) window.clearTimeout(timer);
        };
      }, []);

      const jumpToTurnStart = () => {
        const turn = currentTurn();
        if (!turn) return;
        const token = ++actionRef.current;
        const target = clampTarget(
          turn.scroller,
          absoluteTop(turn.scroller, turn.nodes[turn.index]) - TURN_OFFSET,
        );
        smoothJump(turn.scroller, target, token, actionRef);
      };

      const jumpToTurnEnd = () => {
        const turn = currentTurn();
        if (!turn) return;
        const token = ++actionRef.current;
        const { scroller, nodes, index } = turn;
        const next = nodes[index + 1];
        if (!next) {
          // The turn being read is the latest one: its end is the live end.
          const native = findNativeToBottom(scroller);
          if (native) {
            native.click();
          } else {
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
          }
          window.setTimeout(() => {
            if (actionRef.current !== token || !scroller.isConnected) return;
            const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
            if (gap > 4) scroller.scrollTop = scroller.scrollHeight;
          }, 480);
          return;
        }
        const target = clampTarget(
          scroller,
          absoluteTop(scroller, next) - scroller.clientHeight + END_MARGIN,
        );
        smoothJump(scroller, target, token, actionRef);
      };

      const jumpToLatest = () => {
        const scroller = resolveScroller();
        if (!scroller) return;
        const token = ++actionRef.current;
        const native = findNativeToBottom(scroller);
        if (native) {
          native.click();
        } else {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        }
        window.setTimeout(() => {
          if (actionRef.current !== token || !scroller.isConnected) return;
          const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
          if (gap > 4) scroller.scrollTop = scroller.scrollHeight;
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
            style: { right },
          },
          h(
            "button",
            {
              key: "start",
              type: "button",
              className: "dshJumpBtn",
              title: labels.start,
              "aria-label": labels.start,
              "data-dsh-jump": "turn-start",
              onClick: jumpToTurnStart,
            },
            h(ArrowUp),
          ),
          h(
            "button",
            {
              key: "end",
              type: "button",
              className: "dshJumpBtn",
              title: labels.end,
              "aria-label": labels.end,
              "data-dsh-jump": "turn-end",
              onClick: jumpToTurnEnd,
            },
            h(ArrowDown),
          ),
          h(
            "button",
            {
              key: "latest",
              type: "button",
              className: "dshJumpBtn",
              title: labels.latest,
              "aria-label": labels.latest,
              "data-dsh-jump": "latest",
              onClick: jumpToLatest,
            },
            h(ArrowDownDouble),
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
