import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * has passed without `value` changing again.
 *
 * The original value is untouched — the caller can still render it
 * instantly (e.g. the input's own text as you type). Only the DEBOUNCED
 * copy this hook returns should be used to trigger something expensive,
 * like a network request.
 */

// Generic over <T> — works for a search string today, but also for a filter object or a number later without rewriting it.
export function useDebounce<T>(value: T, delayMs: number): T {
    const [debouncedValue, setDebounceValue] = useState(value);

    useEffect(() =>  {
        // Every time `value` changes, schedule an update `delayMs` from now.
        // If `value` changes AGAIN before that fires, the cleanup function
        // below cancels the pending timer before a new one gets scheduled.
        // That cancel-and-reschedule cycle IS the debounce — nothing more to it.

        const timeoutId = setTimeout(() => {
            setDebounceValue(value);
        }, delayMs);

        return () => clearTimeout(timeoutId);

    }, [value, delayMs]);

    return debouncedValue;
}