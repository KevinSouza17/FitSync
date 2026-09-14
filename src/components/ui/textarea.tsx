import { useRef, useEffect, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
  maxRows?: number;
};

export function AutoTextarea({
  className,
  value,
  minRows = 2,
  maxRows = 12,
  onChange,
  ...props
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const currentHeight = useRef(0);

  function resize() {
    const el = ref.current;
    if (!el) return;
    const prevH = currentHeight.current;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const minH = lineHeight * minRows;
    const maxH = lineHeight * maxRows;
    const scrollH = el.scrollHeight;
    const newH = Math.min(Math.max(scrollH, minH), maxH);
    el.style.height = `${newH}px`;
    currentHeight.current = newH;
    void prevH;
    el.style.overflowY = scrollH > maxH ? "auto" : "hidden";
  }

  useEffect(() => { resize(); }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      rows={minRows}
      className={cn("resize-none", className)}
      {...props}
    />
  );
}
